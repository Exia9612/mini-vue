import { createComponentInstance, setupComponent } from "./component"
// import { isObject } from "../shared/index"
// import { createVNode } from "./vnode"
import { ShapeFlags } from "../shared/ShapeFlags"
import { isOn } from "../shared/index"

// render通过一系列的调用其它函数将vnode挂载到真实节点container下
// 区别于组件中的render
export function render(vnode, container) {
  patch(vnode, container)
}

function patch(vnode, container) {
  const { shapeFlag } = vnode
  if (shapeFlag & ShapeFlags.ELEMENT) {
    // element类型创建dom元素
    processElement(vnode, container)
  } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
    // 当vnode.type为组件对象时，例如createApp创建根组件时
    processComponent(vnode, container)
  }
}

function processElement(vnode, container) {
  mountElement(vnode, container)
}

function mountElement (vnode, container) {
  const el = (vnode.el = document.createElement(vnode.type))

  const { children, props, shapeFlag } = vnode

  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    el.textContent = children
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(vnode, el)
  }

  for (const key in props) {
    const val = props[key]
    if (isOn(key)) {
      const event = key.slice(2).toLowerCase()
      el.addEventListener(event,  val)
    } else {
      el.setAttribute(key, val)
    }
  }

  container.append(el)
}

function mountChildren (vnode, container) {
  vnode.children.forEach((v) => {
    patch(v, container)
  })
}

function processComponent(vnode, container) {
  mountComponent(vnode, container)
}

function mountComponent(initialVnode, container) {
  // 根据组件对象(vnode.type)创建组件实例
  const instance = createComponentInstance(initialVnode)

  // 在组件实例上挂载属性(props render...)
  setupComponent(instance)
  setupRenderEffect(instance, initialVnode, container)
}

// 组件的初始化调用该函数
function setupRenderEffect(instance, initialVnode, container) {
  const  { proxy } = instance
  // 组件实例调用组件对象的render函数(App.js)
  // 绑定代理对象后render可以获取到在组件上挂载(setupComponent的工作)的各项属性
  const subTree = instance.render.call(proxy)

  patch(subTree, container)

  // 该组件的子组件和子元素都挂载(mounted)完成后，挂载根元素
  // 组件实例正在使用的根 DOM 元素。
  initialVnode.el = subTree.el
}