import { PublicInstanceProxyHandlers } from "./componentPublicInstance"
import { initProps } from "./componentProps"
import { shallowReadonly } from "../reactivity/reactive"
import { emit } from "./componentEmit"
import { initSlots } from "./componentSlots"
import { proxyRefs } from "../reactivity/ref"

export function createComponentInstance(vnode, parent) {
  const component = {
    vnode,
    type: vnode.type,
    props: {}, 
    setupState: {},
    slots: {},
    provides: parent ? parent.provides : {},
    parent,
    isMounted: false,
    next: null, // 组件实例更新时的新的虚拟节点
    subTree: {},
    emit: () => {}
  }

  // 将组件自身实例传递给emit函数，在emit函数内查看props上的绑定事件
  component.emit = emit.bind(null, component) as any
  return component
}

export function setupComponent(instance) {
  // 创建虚拟节点时的props应该作为组件的setup函数参数传入
  // 将props挂载到组件的setupState属性上，就可以用过代理获取值了
  initProps(instance, instance.vnode.props) // 将虚拟节点的props挂载到组件实例上
  // 在组件实例的slots上根据对应的vnode的children添加键名相同的对象
  initSlots(instance, instance.vnode.children)
  // 区别于函数组件的创建方法
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance) {
  // Component是组件对象本身
  const Component = instance.type

  // 挂载代理对象
  instance.proxy = new Proxy(
    { _: instance},
    PublicInstanceProxyHandlers
  )

  // 组件对象上可能会有setup函数
  const { setup } = Component

  if (setup) {
    // 该变量在setup函数的闭包中，该闭包保存了currentInstance
    setCurrentInstance(instance)
    const setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit
    })
    setCurrentInstance(null)

    handleSetupResult(instance, setupResult)
  }
}

function handleSetupResult(instance, setupResult) {
  if (typeof setupResult === 'object') {
    instance.setupState = proxyRefs(setupResult)
  }

  finishComponentSetup(instance)
}

function finishComponentSetup (instance) {
  // type属性就是组件对象本身
  const Component = instance.type

  if (Component.render) {
    instance.render = Component.render
  }
}

let currentInstance = null

// 只能在setup和生命周期函数中使用
export function getCurrentInstance() {
  return currentInstance
}

export function setCurrentInstance(instance) {
  currentInstance = instance
}