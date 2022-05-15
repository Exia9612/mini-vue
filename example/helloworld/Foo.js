import { h } from "../../lib/guide-mini-vue.esm.js"

export const Foo = {
  // 通过在组件实例上挂载虚拟节点的props，在mountComponent时传入props
  setup(props) {
    console.log(props)
    props.count++ // readonly 通过 shallowReadonly实现
  },
  render() {
    return h(
      "div",
      {},
      "foo: " + this.count // 在组件实例的代理上检查props
    )
  }
}