import { ShapeFlags } from "../shared/ShapeFlags"

export const Fragment = Symbol("Fragment")
export const Text = Symbol("Text")

export function createVNode(type, props?, children?) {
  // type 可能是一个对象，也是一个组件
  // 可能由h函数调用该函数，type就是字符串，根据type, props, children生成真实节点
  const vnode = {
    type,
    props,
    children,
    component: null, // 虚拟节点属于的组件实例
    key: props && props.key,
    shapeFlag: getShapeFlag(type),
    el: null // 该vnode对应的dom节点
  }

  // children
  if (typeof children === "string") {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
  } else if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  }

  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    // 判断条件可能不是很准确，object太宽泛
    if(typeof children === "object") {
      vnode.shapeFlag |= ShapeFlags.SLOT_CHILDREN
    }
  }

  return vnode
}

// 创建文本节点对应的虚拟节点
export function createTextVNode(text: string) {
  return createVNode(Text, {}, text)
}

function getShapeFlag(type) {
  return typeof type === "string" ? ShapeFlags.ELEMENT : ShapeFlags.STATEFUL_COMPONENT
}