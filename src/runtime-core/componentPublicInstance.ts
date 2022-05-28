import { hasOwnProperty } from "../shared/index"

const publicPropertiesMap = {
  $el: (i) => i.vnode.el,
  $slots: (i) => i.slots,
  $props: (i) => i.props
}

export const PublicInstanceProxyHandlers = {
  // 从代理对象结构_，命名为instance
  get({ _: instance }, key) {
    const { setupState, props } = instance

    if (hasOwnProperty(setupState, key)) {
      return Reflect.get(setupState, key)
    } else if (hasOwnProperty(props, key)) {
      return Reflect.get(props, key)
    }

    const publicGetter = publicPropertiesMap[key]
    if (publicGetter) {
      return publicGetter(instance)
    }
  }
}