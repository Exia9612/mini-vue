import { effect } from '../effect'
import { ref, isRef, unRef, proxyRefs } from '../ref'
import { reactive } from '../reactive'

describe("ref", () => {
  it("ref basic", () => {
    const a = ref(1)
    expect(a.value).toBe(1)
  })

  it("should be reactive", () => {
    const a = ref(1)
    let dummy
    let calls = 0
    effect(() => {
      calls++
      dummy = a.value
    })
    expect(calls).toBe(1)
    expect(dummy).toBe(1)
    a.value = 2
    expect(calls).toBe(2)
    expect(dummy).toBe(2)
    // 相同的赋值不应该触发依赖
    a.value = 2
    expect(calls).toBe(2)
    expect(dummy).toBe(2)
  })

  it("make nested properties reactive", () => {
    const a = ref({
      count: 1
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    a.value.count = 2
    expect(dummy).toBe(2)
  })

  it ("isRef", () => {
    const a = ref(1)
    const user = reactive({
      age: 1
    })
    expect(isRef(a)).toBe(true)
    expect(isRef(1)).toBe(false)
    expect(isRef(user)).toBe(false)
  })

  it ("unRef", () => {
    const a = ref(1)
    expect(unRef(a)).toBe(a.value)
    expect(unRef(1)).toBe(1)
  })

  it("proxyRefs", () => {
    // 嵌套··
    const user = {
      age: ref(10),
      name: 'cheng',
      obj: {
        p1: ref('isaac')
      }
    }

    const proxyUser = proxyRefs(user)

    // expect(proxyUser.obj.p1).toBe('isaac')

    expect(user.age.value).toBe(10)
    expect(proxyUser.age).toBe(10)
    expect(proxyUser.name).toBe('cheng')

    proxyUser.age = 20
    expect(proxyUser.age).toBe(20)
    expect(user.age.value).toBe(20)

    proxyUser.age = ref(10)
    expect(proxyUser.age).toBe(10)
    expect(user.age.value).toBe(10)
  })
})