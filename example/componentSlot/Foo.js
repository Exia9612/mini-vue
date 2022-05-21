import { h, renderSlots } from "../../lib/guide-mini-vue.esm.js"

export const Foo = {
  setup() {
    return {}
  },
  render() {
    /*
      <template>
        <div>
          <slot name=header :age=age></slot>
          <p>foo</p>
          <slot name=footer></slot>
        </div>
      </template>
    */
    const foo = h("p", {}, "foo")
    const age = 18
    return h("div", {}, [
      // <slot name=header :age=age></slot>
      renderSlots(this.$slots, "header", {
        age
      }),
      foo,
      // <slot name=footer></slot>
      renderSlots(this.$slots, "footer")
    ])
  }
}