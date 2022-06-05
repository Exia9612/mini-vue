import { NodeTypes } from "./ast"
import { helperMapName, TO_DISPLAY_STRING, CREATE_ELEMENT_VNODE } from "./runtimeHelpers"
import { isString } from "../../shared/index"

export function generate(ast) {
  const context = createCodegenContext()
  const { push } = context

  genFunctionPreamble(ast, context)

  const functionName = "render"
  const args = ["_ctx", "_cache"]
  const signature = args.join(",")
  push(`function ${functionName}(${signature}) {`)
  push(`return `)
  genNode(ast.codegenNode, context)
  push("}")

  return {
    code: context.code,
  }
}

function createCodegenContext() {
  const context = {
    code: "",
    push(source) {
      context.code += source
    },
    helper(key) {
      return `_${helperMapName[key]}`
    }
  }
  return context
}

// 生成函数返回内容
function genNode(node, context) {
  switch (node.type) {
    case NodeTypes.TEXT:
      genText(context, node)
      break
    case NodeTypes.INTERPOLATION:
      genInterpolation(context, node)
      break
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context)
      break
    case NodeTypes.ELEMENT:
      genElement(node, context)
      break
    case NodeTypes.COMPOUND:
      genCompoundExpression(node, context)
      break
    default:
      break
  }
}

function genElement(node, context) {
  const { push, helper } = context
  const { tag, children, props } = node
  push(`${helper(CREATE_ELEMENT_VNODE)}(`)
  genNodeList(genNullable([tag, props, children]), context)
  // 处理ast子节点
  //genNode(children, context)
  push(")")
}

function genNodeList(nodes, context) {
  const { push } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isString(node)) {
      push(node)
    } else {
      genNode(node, context)
    }

    if (i < nodes.length - 1) {
      push(", ")
    }
  }
}

function genNullable(args: any) {
  return args.map((arg) => arg || "null");
}

// 生成导入逻辑
function genFunctionPreamble(ast, context) {
  const { push } = context
  const VueBinging = "Vue"
  const aliasHelper = (s) => `${helperMapName[s]}: _${helperMapName[s]}`

  if (ast.helpers.length > 0) {
    // 有需要导入的函数
    push(`const { ${ast.helpers.map(aliasHelper).join(", ")} } = ${VueBinging}`)
  }

  push("\n")
  push("return ")
}

// ast节点类型为text节点时需要返回的内容
function genText(context, node) {
  const { push } = context
  push(`'${node.content}'`)
}

function genInterpolation(context, node) {
  const { push, helper } = context
  push(`${helper(TO_DISPLAY_STRING)}(`)
  // 处理插值ast节点的simpleexpression节点
  genNode(node.content, context)
  push(")")
}

function genExpression(node, context) {
  const { push } = context
  push(`${node.content}`)
}

function genCompoundExpression(node, context) {
  const { push } = context
  const children = node.children
  for (const child of children) {
    if (isString(child)) {
      push(child)
    } else {
      genNode(child, context)
    }
  }
}