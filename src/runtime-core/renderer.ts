import { createComponentInstance, setupComponent } from "./component"
import { ShapeFlags } from "../shared/ShapeFlags"
import { Fragment, Text } from "./vnode"
import { createAppAPI } from "./createApp"
import { effect } from "../reactivity/effect"
import { EMPTY_OBJ } from "../shared/index"

export function createRenderer (options) { 
  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText
  } = options

  // render通过一系列的调用其它函数将vnode挂载到真实节点container下
  // 区别于组件中的render
  function render(vnode, container) {
    patch(null, vnode, container, null)
  }

  function patch(oldVnode, newVnode, container, parentComponent) {
    const { type, shapeFlag } = newVnode

    switch (type) {
      case Fragment:
        processFragment(oldVnode, newVnode, container, parentComponent)
        break
      case Text:
        processText(oldVnode, newVnode, container)
        break
      default:
        // Fragment -> 只渲染children
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // element类型创建dom元素
          processElement(oldVnode, newVnode, container, parentComponent)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          // 当vnode.type为组件对象时，例如createApp创建根组件时
          processComponent(oldVnode, newVnode, container, parentComponent)
        }
    }
  }

  function processText(oldVnode, newVnode, container) {
    const { children } = newVnode
    const textNode = (newVnode.el = document.createTextNode(children))
    container.append(textNode)
  }

  function processFragment(oldVnode, newVnode, container, parentComponent) {
    mountChildren(newVnode.children, container, parentComponent)
  }

  function processElement(oldVnode, newVnode, container, parentComponent) {
    if (!oldVnode) {
      mountElement(newVnode, container, parentComponent)
    } else {
      patchElement(oldVnode, newVnode, container, parentComponent)
    }
  }

  function patchElement(oldVnode, newVnode, container, parentComponent) {
    const oldProps = oldVnode.props || EMPTY_OBJ
    const newProps = newVnode.props || EMPTY_OBJ
    const el = (newVnode.el = oldVnode.el)

    patchChildren(oldVnode, newVnode, container, parentComponent)
    patchProps(el, oldProps, newProps)
  }

  function patchChildren(oldVnode, newVnode, container, parentComponent) {
    const { shapeFlag: prevShapeFlag, children: prevChildren } = oldVnode //n1 
    const { shapeFlag, children: nextChildren } = newVnode //n2

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 清空原children
        unmountChildren(oldVnode.children)
      }
      if (prevChildren !== nextChildren) {
        hostSetElementText(container, nextChildren)
      }
    } else {
      // 更新的节点是一个数组
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, "")
        mountChildren(nextChildren, container, parentComponent)
      }
    }
  }

  function unmountChildren(children) {
    for (let i = 0; i < children.length; i++) {
      const el = children[i].el
      hostRemove(el)
    }
  }

  function patchProps(el, oldProps, newProps) {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        const prevProp = oldProps[key]
        const nextProp = newProps[key]
  
        if (prevProp !== nextProp) {
          hostPatchProp(el, key, prevProp, nextProp)
        }
      }
  
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if(!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  function mountElement (vnode, container, parentComponent) {
    const el = (vnode.el = hostCreateElement(vnode.type))

    const { children, props, shapeFlag } = vnode

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode.children, el, parentComponent)
    }
    // 是否需要处理SLOT_CHILDREN

    for (const key in props) {
      const val = props[key]
      hostPatchProp(el, key, null, val)
    }

    // container.append(el)
    hostInsert(el, container)
  }

  function mountChildren (children, container, parentComponent) {
    console.log(children)
    children.forEach((v) => {
      patch(null, v, container, parentComponent)
    })
  }

  function processComponent(oldVnode, newVnode, container, parentComponent) {
    mountComponent(newVnode, container, parentComponent)
  }

  function mountComponent(initialVnode, container, parentComponent) {
    // 根据组件对象(vnode.type)创建组件实例
    // 组件的vnode属性就是用组件自己创建的createVnode
    // type属性就是组件文件本身
    const instance = createComponentInstance(initialVnode, parentComponent)

    // 在组件实例上挂载属性(props render...)，完善组件实例
    setupComponent(instance)
    setupRenderEffect(instance, initialVnode, container)
  }

  // 组件的初始化调用该函数
  function setupRenderEffect(instance, initialVnode, container) {
    effect(() => {
      if (!instance.isMounted) {
        const  { proxy } = instance
        // 组件实例调用组件对象的render函数(App.js)
        // 绑定代理对象后render可以获取到在组件上挂载(setupComponent的工作)的各项属性
        // 相当于在template上使用data中的变量， instance.render.call(proxy)返回的等于该组件的template标签中的内容
        instance.subTree = instance.render.call(proxy)
        const subTree = instance.subTree

        patch(null, subTree, container, instance)

        // 该组件的子组件和子元素都挂载(mounted)完成后，挂载根元素
        // 组件实例正在使用的根 DOM 元素。
        initialVnode.el = subTree.el
        instance.isMounted = true
      } else {
        console.log('update')
        const {
          proxy,
          subTree: prevSubTree
        } = instance

        instance.subTree = instance.render.call(proxy)
        const subTree = instance.subTree

        patch(prevSubTree, subTree, container, instance)
      }
    })
  }

  return {
    createApp: createAppAPI(render)
  }
}