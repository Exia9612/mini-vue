import { ShapeFlags } from "../shared/ShapeFlags"

export function initSlots(instance, children) {
  const { vnode } = instance
  if (vnode.shapeFlag & ShapeFlags.SLOT_CHILDREN) {
    normalizeObjectSlots(children, instance.slots)
  }
}

// 在组件实例的slots上根据对应的vnode的children添加键名相同的对象，参数是组件实例的props 
function normalizeObjectSlots(children, slots) {
  for (const key in children) {
    const value = children[key]
    slots[key] = (props) => normalizeSlotValue(value(props))
  }
}

function normalizeSlotValue(value) {
  return Array.isArray(value) ? value : [value]
}