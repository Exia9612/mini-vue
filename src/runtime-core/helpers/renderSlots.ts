import { createVNode, Fragment } from "../vnode";

export function renderSlots(slots, name, props) {
  // slots一般是组件实例的$slots
  const slot = slots[name]

  if (slot) {
    if (typeof slot === "function") {
      return createVNode(Fragment, {}, slot(props))
    }
  }
}