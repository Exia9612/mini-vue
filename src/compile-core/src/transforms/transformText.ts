import { NodeTypes } from "../ast";

// 当标签类型节点中有连续的文本或插值表达式类型节点，将他们组成复合类型
export function transformText(node) {
  function isText (node) {
    return (
      node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION
    )
  }

  if (node.type === NodeTypes.ELEMENT) {
    return () => {
      const { children } = node
      let currentContainer

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          // 如果当前节点类型为文本或插值表达式类型，检查下一个节点
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              // 连续的文本或插值表达式类型节点，用复合节点类型替换
              if (!currentContainer) {
                // 初始化currentContainer
                // 用复合节点替换连续的文本或插值表达式类型节点中的第一个节点
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND,
                  children: [child]
                }
              }

              currentContainer.children.push(" + ")
              currentContainer.children.push(next)
              children.splice(j, 1)
              j--
            } else {
              // 不是连续的文本或插值表达式类型节点，返回
              currentContainer = null
              break
            }
          }
        }
      }
    }
  }
}