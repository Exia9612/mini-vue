import { getCurrentInstance } from "./component";

export function provide(key, value) {
  // 在setup中调用
  const currentInstance: any = getCurrentInstance()

  if (currentInstance) {
    let { provides } = currentInstance
    const parentProvides = currentInstance.parent.provides

    // 仅初始化执行
    if (provide === parentProvides) {
      // 通过原型链解决provide自底向上查找的过程
      provides = currentInstance.provides = Object.create(parentProvides)
    }

    provides[key] = value
  }
}

export function inject(key, defaultValue?) {
  const currentInstance: any = getCurrentInstance()

  if (currentInstance) {
    const parentProvides = currentInstance.parent.provides
    
    if (key in parentProvides) {
      return parentProvides[key]
    } else if (defaultValue && typeof defaultValue === 'function') {
      return defaultValue()
    } else {
      return defaultValue
    }
  }
}