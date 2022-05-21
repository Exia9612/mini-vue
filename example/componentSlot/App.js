import { h, createTextVNode } from "../../lib/guide-mini-vue.esm.js"
import { Foo } from "./Foo.js"

export const App = {
  name: "App",
  render () {
    /*
      <template>
        <div>
          <div>
            App
          </div>
          <Foo>
            <span v-slot:header="slotProps">{{ "header" + slotProps.age }}</span>
            <span v-slot:footer>{{ "footer" }}</span>
          </Foo>
        </div>
      </template>
    */
    const app = h("div", {}, "App")
    const foo = h(
      Foo,
      {},
      {
        // 具名插槽 + 作用域插槽
        // 使用Foo组件插槽在slot(<slot :age=age></slot>)中暴露的age变量，用header age替换slot内容
        //<span v-slot:header="slotProps">{{ "header" + slotProps.age }}</span>
        header: ({ age }) => [
          h("span", {}, "header " + age), // Foo组件自己的props中的age
          createTextVNode('hello world')
        ],
        footer: () => h("span", {}, "footer")
      }
    )
    return h("div", {}, [app, foo])
  },

  setup () {
    return {}
  }
}