import { PublicInstanceProxyHandlers } from "./componentPublicInstance"
import { initProps } from "./componentProps"
import { shallowReadonly } from "../reactivity/reactive"
import { emit } from "./componentEmit"

export function createComponentInstance(vnode) {
  const component = {
    vnode,
    type: vnode.type,
    props: {}, 
    setupState: {},
    emit: () => {}
  }

  // 将组件自身实例传递给emit函数，在emit函数内查看props上的绑定事件
  component.emit = emit.bind(null, component) as any
  return component
}

export function setupComponent(instance) {
  // 创建虚拟节点时的props应该作为组件的setup函数参数传入
  //将props挂载到组件的setupState属性上，就可以用过代理获取值了
  initProps(instance, instance.vnode.props) // 将props挂载到组件实例上
  // 区别于函数组件的创建方法
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance) {
  const Component = instance.type

  // 挂载代理对象
  instance.proxy = new Proxy(
    { _: instance},
    PublicInstanceProxyHandlers
  )

  // 组件对象上可能会有setup函数
  const { setup } = Component

  if (setup) {
    const setupResult = setup(shallowReadonly(instance.props), {
      emit: instance.emit
    })

    handleSetupResult(instance, setupResult)
  }
}

function handleSetupResult(instance, setupResult) {
  if (typeof setupResult === 'object') {
    instance.setupState = setupResult
  }

  finishComponentSetup(instance)
}

function finishComponentSetup (instance) {
  const Component = instance.type

  if (Component.render) {
    instance.render = Component.render
  }
}