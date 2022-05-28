import { NodeTypes } from "./ast"

export function baseParse (content: string) {
  const context = createParserContext(content)
  return createRoot(parseChildren(context))
}

function parseChildren(context) {
  const nodes: any = [] // ast树的节点
  let node
  if (context.source.startsWith("{{")) {
    node = parseInterpolation(context)
  }
  nodes.push(node)
  return nodes
}

// 处理插值表达式为ast树
function parseInterpolation(context) {
  const openDelimiter = "{{"
  const closeDelimiter = "}}"

  const closeIndex = context.source.indexOf(closeDelimiter, openDelimiter.length)
  advanceBy(context, openDelimiter.length)

  const rawContentLength = closeIndex - openDelimiter.length
  const rawCcontent = context.source.slice(0, rawContentLength)
  const content = rawCcontent.trim()

  advanceBy(context, rawContentLength + closeDelimiter.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: content
    }
  }
}

function advanceBy(context: any, length: number) {
  context.source = context.source.slice(length)
}

// 创建ast树的根节点
function createRoot (children) {
  return {
    children
  }
}

// 创建全局上下文对象
function createParserContext(content: string): any {
  return {
    source: content
  }
}