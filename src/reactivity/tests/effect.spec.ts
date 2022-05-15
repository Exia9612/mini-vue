// jest运行环境是node，使用esm需要bebel转换
import { reactive } from '../reactive'
import { effect, stop } from '../effect'

describe("effect", () => {
  it("reactive function test", () => {
    const user = reactive({
      age: 10
    })

    let nextAge;
    effect(() => {
      nextAge = user.age + 1
    })

    expect(nextAge).toBe(11)

    // check reactivity when update
    user.age++
    expect(nextAge).toBe(12)
  })

  it("should return runner when call effect", () => {
    // 1. effect(fn) -> function (runner) -> fn -> return
    let foo = 10
    const runner = effect(() => {
      foo++
      return 'foo'
    })

    expect(foo).toBe(11)
    // runner再次执行effect中的回调函数
    const res = runner()
    expect(foo).toBe(12)
    expect(res).toBe('foo')
  })

  it("scheduler", () => {
    // schedular 实现了初始化和更新的逻辑分离
    let dummy;
    let run: any
    const scheduler = jest.fn(() => {
      run = runner
    })

    const obj = reactive({ 'foo': 1 })
    const runner = effect(() => {
      // effect数据响应式的逻辑
      dummy = obj.foo
    }, { scheduler })

    // effect初始化时执行第一个回调函数
    expect(scheduler).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    obj.foo++
    // 响应式数据发生改变时
    expect(scheduler).toHaveBeenCalled()
    expect(dummy).toBe(1)
    run()
    expect(dummy).toBe(2)
  })

  it("stop", () => {
    // stop函数功能：阻止数据响应式的更新逻辑自动调用，但不阻止手动调用
    let dummy
    let obj = reactive({ "prop": 1 })
    const runner = effect(() => {
      dummy = obj.prop
    })
    obj.prop = 2
    expect(dummy).toBe(2)
    // stop automatically call runner
    stop(runner)
    // obj.prop = 3
    obj.prop++
    expect(dummy).toBe(2)
    // but do not stop manully call runner
    runner()
    expect(dummy).toBe(3)
  })

  it("onstop", () => {
    // 数据响应的处理逻辑(runner)被stop时的处理逻辑
    let dummy
    const obj = reactive({ foo: 1 })
    const onStop = jest.fn()
    const runner = effect(
      () => {
        dummy = obj.foo
      },
      {
        onStop
      }
    )
    expect(dummy).toBe(1)
    stop(runner)
    expect(onStop).toBeCalledTimes(1)
  })
})