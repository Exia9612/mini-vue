export * from './toDisplayString'

export const extend = Object.assign

export const isObject = (val) => {
  return val !== null && typeof val === "object"
}

export const hasChanged = (value1, value2) => {
  return !Object.is(value1, value2)
}

export const isOn = (key: string) => {
  return /^on[A-Z]/.test(key)
}

export const isString = (value) => {
  return typeof value === 'string'
}

export const hasOwnProperty = (obj, key) => {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const toHandlerKey = (str: string) => {
  return str ? "on" + capitalize(str) : "" 
}

export const camelize = (str: string) => {
  return str.replace(/-(\w)/g, (_, c: string) => {
    return c ? c.toUpperCase() : ""
  })
}

export const EMPTY_OBJ = {}