import { createRenderer } from '../runtime-core/index'
import { isOn } from '../shared/index'

// 基于dom的渲染接口
function createElement(type) {
  return document.createElement(type)
}

// 更新dom元素的属性(标签的属性)
function patchProp(el, key, prevVal, nextVal) {
  if (isOn(key)) {
    const event = key.slice(2).toLowerCase()
    el.addEventListener(event, nextVal)
  } else {
    if (nextVal === undefined || nextVal === null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, nextVal)
    }
  }
}

// function insert(child, parent, anchor) {
//   parent.insertBefore(child, anchor || null);
// }

function insert(el, parent, anchor) {
  parent.insertBefore(el, anchor || null)
}

function remove(child) {
  // 从父节点移出当前子节点
  const parent = child.parentNode
  if (parent) {
    parent.removeChild(child)
  }
}

function setElementText(el, text) {
  el.textContent = text
}

const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
  remove,
  setElementText
})

export function createApp(...args) {
  return renderer.createApp(...args)
}

export * from '../runtime-core/index'