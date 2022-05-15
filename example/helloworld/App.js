import { h } from "../../lib/guide-mini-vue.esm.js"
import { Foo } from "./Foo.js"

export const App = {
  render () {
    return h(
      "div",
      {
        id: "root",
        class: ["red", "hard"],
        onClick() {
          console.log("click")
        }
      },
      // "h1, " + this.msg
      [
        h("div", { class: "red" }, "hi, " + this.msg),
        h(Foo, { count: 1 })
      ]
    )
  },

  setup () {
    return {
      msg: "mini-vue"
    }
  }
}