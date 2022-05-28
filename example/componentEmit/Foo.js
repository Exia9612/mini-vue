import { h } from "../../lib/guide-mini-vue.esm.js"

export const Foo = {
  setup(props, { emit }) {
    // 传入了组件实例的emit(component.emit)
    // 该emit已经被传入了组件实例作为参数
    const emitAdd = () => {
      emit("add", 1, 2)
      emit("add-foo")
    }

    return {
      emitAdd
    }
  },
  render() {
    const btn = h(
      "button",
      {
        onClick: this.emitAdd
      },
      "emitAdd"
    )

    const foo = h("p", {}, "foo")
    return h("div", {}, [foo, btn])
  }
}