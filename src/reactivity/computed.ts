import { ReactiveEffect } from './effect'

class ComputedRefImpl {
  private _getter: any
  private _value: any // 缓存计算后的值
  private _dirty: boolean = true // 是否重新计算_value的标志
  private _effect: any

  constructor (getter) {
    this._getter = getter
    // 在getter如果有对响应式对象的操作，此时并不会收集this._effect
    // 因为我们并没有通过this._effect.run改变activeEffect和shouldeffect
    this._effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
      }
    })
  }

  get value() {
    if (this._dirty) {
      this._dirty = false
      this._value = this._effect.run()
    }
    return this._value
  }
}

export function computed(getter) {
  return new ComputedRefImpl(getter)
}