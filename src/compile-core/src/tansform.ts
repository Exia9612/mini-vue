import { NodeTypes } from "./ast";
import { TO_DISPLAY_STRING } from "./runtimeHelpers";

export function transform(root, options = {}) {
  const context = createTransformContext(root, options)
  // 1 dfs ast树
  traverseNode(root, context)
  // 创建一个入口节点，codegen根据这个入口节点生成render函数
  createRootCodegen(root)
  // ast根节点添加属性
  root.helpers = [...context.helpers.keys()]
}

function createRootCodegen(root: any) {
  const child = root.children[0]
  if (child.type === NodeTypes.ELEMENT) {
    root.codegenNode = child.codegenNode
  } else {
    root.codegenNode = root.children[0]
  }
}

function createTransformContext(root, options) {
  const context = {
    root,
    nodeTransforms: options.nodeTransforms || [],
    helpers: new Map(), // 处理不同类型ast需要引入的函数
    helper(key) {
      context.helpers.set(key, 1)
    }
  }
  return context
}

function traverseNode(node: any, context) {
  const nodeTransforms = context.nodeTransforms
  const exitFns: any = []
  for (const fn of nodeTransforms) {
    // 根据外部插件处理节点
    const onExit = fn(node, context)
    if (onExit) exitFns.push(onExit)
  }

  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING)
      break
    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT:
      traverseChildren(node, context)
      break
    default:
      break
  }

  // 插件先正序调用在倒序待调用
  let i = exitFns.length
  while(i--) {
    exitFns[i]()
  }
}

function traverseChildren(node, context) {
  const children = node.children
  for (const child of children) {
    traverseNode(child,context)
  }
}