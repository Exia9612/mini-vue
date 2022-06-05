import { NodeTypes } from "../ast";

// 处理插值表达式中的simpleexpression的插件
export function transformExpression(node) {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(node.content)
  }
}

function processExpression(node) {
  node.content = `_ctx.${node.content}` // simpleexpress前加上_ctx
  return node
}