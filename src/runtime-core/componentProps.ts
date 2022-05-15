// 将props挂载到组件实例上
export function initProps(instance, rawProps) {
  instance.props = rawProps || {}
}