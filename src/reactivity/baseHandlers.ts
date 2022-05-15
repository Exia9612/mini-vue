import { trigger, track } from "./effect"
import { ReactiveFlags, reactive, readonly } from "./reactive"
import { isObject, extend } from '../shared/index'

// get操作的处理逻辑相同，只需要生成一次
const get = createGetter()
const set = createSetter()
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

function createGetter(isReadonly = false, shallow = false) {
  return function (target, key) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly // 闭包
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    }

    const res = Reflect.get(target, key)

    if (shallow) {
      return res
    }

    if(isObject(res)) {
      // 代理嵌套对象
      return isReadonly ? readonly(res) : reactive(res)
    }

    // 依赖收集
    if (!isReadonly) {
      track(target, key)
    }
    return res
  }
}

function createSetter () {
  return function (target, key, value) {
    const res = Reflect.set(target, key, value)
    // 触发依赖
    trigger(target, key)
    return res
  }
}

export const mutableHandlers = {
  get,
  set
}

export const readonlyHandlers = {
  get: readonlyGet,
  set (target, key, value) {
    console.warn(`key: ${key} is readonly`, target)
    return true
  }
}

export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
  get: shallowReadonlyGet
})