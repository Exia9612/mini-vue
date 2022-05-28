import { extend } from "../shared/index"

let activeEffect // 当前正在被触发的响应式逻辑
let shouldTrack // 是否收集依赖
const targetMap = new Map()

// 收集响应式数据发生变化时的依赖(fn，用户定义的逻辑)
export class ReactiveEffect {
  private _fn: any
  public deps = []
  public active = true // 标记effect是否被stop
  public onStop?: () => void // stop时用户添加的处理逻辑

  constructor (_fn, public scheduler?) {
    this._fn = _fn
    this.scheduler = scheduler
  }

  run () {
    if (!this.active) {
      return this._fn()
    }

    shouldTrack = true
    activeEffect = this
    const result = this._fn()
    // 下一次的get中的track闭包中的shouldTrack是false
    shouldTrack = false

    return result
  }

  stop () {
    if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

function cleanupEffect (effect) {
  effect.deps.forEach((dep: any) => {
    dep.delete(effect)
  })
}

export function isTracking () {
  return shouldTrack && activeEffect !== undefined
}

export function track (target, key) {
  // 在没有使用effect且触发track时，activeEffect为undefined
  if (!isTracking()) return

  // map的映射关系是target(被代理的对象) -> key -> dep(依赖收集容器，类型是集合)
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  let deps = depsMap.get(key)
  if (!deps) {
    // 依赖收集中的依赖唯一
    deps = new Set()
    depsMap.set(key, deps)
  }

  // 将引用了activeEffect的依赖的应用添加到activeEffect的deps中
  // 这样在某个effect stop时可以直接在相同的引用中delete自身
  trackEffects(deps)
}

export function trackEffects (deps) {
  if (deps.has(activeEffect)) return
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

export function trigger(target, key) {
  let depsMap = targetMap.get(target)
  let deps = depsMap.get(key)

  triggerEffects(deps)
}

export function triggerEffects (deps) {
  for (const effect of deps) {
    // 有更新逻辑按照更新逻辑，无更新逻辑按照初始化逻辑
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
 
export function effect (fn, options: any = {}) {
  // 在使用effect为响应式对象添加数据响应时的逻辑时，因为通常在fn中会有对响应式对象的get、set等操作
  // 必定会收集依赖和触发依赖(track trigger)
  // 在依赖收集过程中将target,key,fn建立映射关系，
  // 在触发依赖是通过映射关系找到对应的依赖
  const _effect = new ReactiveEffect(fn, options.scheduler)
  extend(_effect, options)

  _effect.run()
  const runner: any = _effect.run.bind(_effect)
  runner.effect = _effect

  return runner
}

export function stop(runner) {
  // runner = effect.run
  runner.effect.stop()
}
 
