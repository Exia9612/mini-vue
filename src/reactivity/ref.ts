import { trackEffects, triggerEffects, isTracking } from './effect'
import { hasChanged, isObject } from '../shared'
import { reactive } from './reactive'

// proxy针对对象做代理，对于基础值来说应该用对象做响应式

class RefImpl {
  private _value: any
  public dep // 在effect中，不光reactive对象需要收集触发依赖，ref对象也一样
  private _rawValue // 存储ref时的原始值，在可能被转换为proxy对象之前
  public __v_isRef = true

  constructor (value) {
    this._rawValue = value
    // value如果是object类型，需要用reactivet包裹
    this._value = convert(value)
    this.dep = new Set()
  }

  get value () {
    trackRefValue(this)
    return this._value
  }

  set value (newValue) {
    if (hasChanged(this._rawValue, newValue)) {
      this._rawValue = newValue
      this._value = convert(newValue)
      // 触发依赖
      triggerEffects(this.dep)
    }
  }
}

// 如果被ref的值是一个对象，将它装换为reavtice并赋值给this._value
function convert (value) {
  return isObject(value) ? reactive(value) : value
}

function trackRefValue (ref) {
  // 当使用effect时才有依赖需要收集
  if (isTracking()) {
    // 收集依赖
    trackEffects(ref.dep)
  }
}

export function ref (value) {
  return new RefImpl(value)
}

export function isRef (ref) {
  return !!ref.__v_isRef
}

export function unRef (ref) {
  // 如果参数是一个 ref，则返回内部值，否则返回参数本身
  return isRef(ref) ? ref.value : ref
}

// 可以不通过ref.value的访问ref的值
export function proxyRefs(objectWithRefs) {
  return new Proxy(objectWithRefs, {
    get (target, key) {
      // 针对target[key]为object且有属性为ref时
      let res = unRef(Reflect.get(target, key))

      if (isObject(res)) {
        return proxyRefs(res)
      }

      return res
      // return unRef(Reflect.get(target, key))
    },
    set (target, key, value) {
      if (isRef(target[key]) && !isRef(value)) {
        return (target[key].value = value)
      } else {
        return Reflect.set(target, key, value)
      }
    }
  })
}