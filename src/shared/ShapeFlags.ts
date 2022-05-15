// 虚拟节点类型
// 前两位flag表示虚拟节点自身的类型
// 后两位表示虚拟节点children的类型
export const enum ShapeFlags {
  ELEMENT = 1,
  STATEFUL_COMPONENT = 1 << 1,
  TEXT_CHILDREN = 1 << 2,
  ARRAY_CHILDREN = 1 << 3
}