import { capitalize, toHandlerKey, camelize } from "../shared/index"

export function emit (instance, eventName, ...args) {
  // 需要在组件的props中查看是否有event对应的回调函数
  const { props } = instance
  const camelizeName = camelize(eventName)
  const handlerName = toHandlerKey(capitalize(camelizeName))

  const handler = props[handlerName]
  handler && handler(...args)
}