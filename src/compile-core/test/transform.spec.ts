import { baseParse } from "../src/parse"
import { transform } from "../src/tansform"
import { NodeTypes } from "../src/ast"

describe('transform', () => {
  it("happy pass", () => {
    const ast = baseParse("<div>hi,{{message}}</div>")

    // 增加处理节点的插件，在需要处理节点时定义，并在处理时调用
    // 🈶由外部定义处理程序，拓展性高
    const plugin = (node) => {
      if (node.type === NodeTypes.TEXT) {
        node.content = node.content + 'mini-vue'
      }
    }

    transform(ast, {
      nodeTransforms: [plugin]
    })

    const nodeText = ast.children[0].children[0]
    expect(nodeText.content).toBe("hi,mini-vue")
  })
})