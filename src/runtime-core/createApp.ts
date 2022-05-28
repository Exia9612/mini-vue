import { createVNode } from "./vnode"

export function createAppAPI(render) {
  return function createApp(rootComponent) {
    return {
      // 通过闭包保存根组件rootCompoment
      mount(rootContainer) {
        const vnode = createVNode(rootComponent) // 组件也有对应的vnode
        render(vnode, rootContainer)
      }
    }
  }
}
