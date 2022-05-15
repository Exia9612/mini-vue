import { mutableHandlers, readonlyHandlers, shallowReadonlyHandlers } from './baseHandlers'
import { isObject } from '../shared/index'

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly'
}

function createReactiveObject(raw: any, baseHandlers) {
  if (!isObject(raw)) {
    console.warn(`target ${raw} 必须是一个对象`)
    return raw
  }

  return new Proxy(raw, baseHandlers)
}

// 为一个对象创建代理，返回代理对象
export function reactive(raw) {
  return createReactiveObject(raw, mutableHandlers)
}

export function shallowReadonly (raw) {
  return createReactiveObject(raw, shallowReadonlyHandlers)
}

export function isReactive (value) {
  // 对于非proxy对象，它的ReactiveFlags.IS_REACTIVE属性为undefined，返回false
  // 对于proxy对象，通过触发它的get操作，在get处理逻辑中判断isreactive
  return !!value[ReactiveFlags.IS_REACTIVE]
}

export function isReadonly (value) {
  return !!value[ReactiveFlags.IS_READONLY]
}

export function isProxy (value) {
  return isReactive(value) || isReadonly(value)
} 

export function readonly (raw) {
  return createReactiveObject(raw, readonlyHandlers)
}
