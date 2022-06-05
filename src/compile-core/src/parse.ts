import { NodeTypes } from "./ast"

const enum TagType {
  Start,
  End
}

export function baseParse (content: string) {
  // content是template模版内容
  const context = createParserContext(content)
  return createRoot(parseChildren(context, []))
}

function advanceBy(context: any, length: number) {
  context.source = context.source.slice(length)
}

// 创建ast树的根节点
function createRoot (children) {
  return {
    children,
    type: NodeTypes.ROOT
  }
}

// 创建全局上下文对象
function createParserContext(content: string): any {
  return {
    source: content
  }
}

function parseChildren(context, ancestors) {
  // ancestores存储正在解析的起始标签
  const nodes: any = [] // ast树的节点

  while(!isEnd(context, ancestors)) {
    let node
    const s = context.source

    if (s.startsWith("{{")) {
      node = parseInterpolation(context)
    } else if(s[0] === "<") {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors)
      }
    }

    // 文本节点
    if (!node) {
      node = parseText(context)
    }
    nodes.push(node)
  }
  return nodes
}

function isEnd(context, ancestors) {
  const s = context.source
  if (s.startsWith("</")) {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const tag = ancestors[i].tag
      if (startsWithEndTagOpen(s, tag)) {
        return true
      }
    }
  }

  return !s
}

// 处理插值表达式为ast树
function parseInterpolation(context) {
  const openDelimiter = "{{"
  const closeDelimiter = "}}"

  const closeIndex = context.source.indexOf(closeDelimiter, openDelimiter.length)
  advanceBy(context, openDelimiter.length)

  const rawContentLength = closeIndex - openDelimiter.length
  const rawCcontent = parseTextData(context, rawContentLength)
  const content = rawCcontent.trim()

  advanceBy(context, closeDelimiter.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: content
    }
  }
}

function parseElement(context: any, ancestors) {
  const element: any = parseTag(context, TagType.Start)
  ancestors.push(element)
  element.children = parseChildren(context, ancestors)
  ancestors.pop()

  // 开始标签与结束标签是否一致
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End)
  } else {
    throw new Error(`lack end tag: ${element.tag}`)
  }
  return element
}

function startsWithEndTagOpen(source, tag) {
  return source.startsWith("</") && source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase()
}

function parseTag(context: any, type: TagType) {
  // 解析tag
  const match: any = /^<\/?([a-z]*)/i.exec(context.source)
  const tag = match[1]
  // 删除解析后的代码
  advanceBy(context, match[0].length)
  // 删除">"
  advanceBy(context, 1)

  if (type === TagType.End) return

  return {
    type: NodeTypes.ELEMENT,
    tag
  }
}

function parseText(context: any) {
  let endIndex = context.source.length
  let endTokens = ["{{", "<"]

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i])
    if (index !== -1 && endIndex > index) {
      endIndex = index
    } 
  }

  // 获取content
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content
  }
}

function parseTextData(context: any, length) {
  const content = context.source.slice(0, length)
  advanceBy(context, length)
  return content
}
