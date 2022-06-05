import { createComponentInstance, setupComponent } from "./component"
import { ShapeFlags } from "../shared/ShapeFlags"
import { Fragment, Text } from "./vnode"
import { createAppAPI } from "./createApp"
import { effect } from "../reactivity/effect"
import { EMPTY_OBJ } from "../shared/index"
import { shouldUpdateComponent } from "./componentUpdateUtils"
import { queueJobs } from "./scheduler"

export function createRenderer (options) {
  // 用户可以自定义以下函数，实现自定义的渲染函数
  const {
    createElement: hostCreateElement, // 创建dom元素
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText
  } = options

  // render通过一系列的调用其它函数将vnode挂载到真实节点container下
  // 区别于组件中的render
  function render(vnode, container) {
    patch(null, vnode, container, null, null)
  }

  function patch(oldVnode, newVnode, container, parentComponent, anchor) {
    const { type, shapeFlag } = newVnode

    switch (type) {
      case Fragment:
        // Fragment类型的组件忽略父组件，将父组件中的内容直接挂载到container中
        processFragment(oldVnode, newVnode, container, parentComponent, anchor)
        break
      case Text:
        // 处理文本类型的节点
        processText(oldVnode, newVnode, container)
        break
      default:
        // Fragment -> 只渲染children
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // element类型创建dom元素
          processElement(oldVnode, newVnode, container, parentComponent, anchor)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          // 当vnode.type为组件对象时，例如createApp创建根组件时
          processComponent(oldVnode, newVnode, container, parentComponent, anchor)
        }
    }
  }

  function processText(oldVnode, newVnode, container) {
    const { children } = newVnode
    const textNode = (newVnode.el = document.createTextNode(children))
    container.append(textNode)
  }

  function processFragment(oldVnode, newVnode, container, parentComponent, anchor) {
    mountChildren(newVnode.children, container, parentComponent, anchor)
  }

  function processElement(oldVnode, newVnode, container, parentComponent, anchor) {
    if (!oldVnode) {
      mountElement(newVnode, container, parentComponent, anchor)
    } else {
      patchElement(oldVnode, newVnode, container, parentComponent, anchor)
    }
  }

  function patchElement(oldVnode, newVnode, container, parentComponent, anchor) {
    const oldProps = oldVnode.props || EMPTY_OBJ
    const newProps = newVnode.props || EMPTY_OBJ
    const el = (newVnode.el = oldVnode.el)

    patchChildren(oldVnode, newVnode, el, parentComponent, anchor)
    patchProps(el, oldProps, newProps)
  }

  function patchChildren(oldVnode, newVnode, container, parentComponent, anchor) {
    const { shapeFlag: prevShapeFlag, children: prevChildren } = oldVnode //n1 
    const { shapeFlag, children: nextChildren } = newVnode //n2

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 清空原children节点
        unmountChildren(oldVnode.children)
      }
      if (prevChildren !== nextChildren) {
        hostSetElementText(container, nextChildren)
      }
    } else {
      // 选虚拟节点children为数组，新的是文本
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, "")
        mountChildren(nextChildren, container, parentComponent, anchor)
      } else {
        // array diff array
        patchKeyedChildren(prevChildren, nextChildren, container, parentComponent, anchor)
      }
    }
  }

  // diff
  function patchKeyedChildren(prevChildren, nextChildren, container, parentComponent, parentAnchor) {
    // 1 双端对比确定中间不同的节点的范围
    let start = 0 // i
    let l2 = nextChildren.length
    let e1 = prevChildren.length - 1
    let e2 = l2 - 1

    function isSameVnode(vnode1, vnode2) {
      return vnode1.type === vnode2.type && vnode1.key === vnode2.key
    }

    // 左右侧双端对比，确定中间的不同的范围
    // 左侧对比
    while (start <= e1 && start <= e2) {
      const vnodeInPrev = prevChildren[start]
      const vnodeInNext = nextChildren[start]

      if (isSameVnode(vnodeInPrev, vnodeInNext)) {
        // 相同节点复用老节点，复用节点的渲染效率更高
        patch(vnodeInPrev, vnodeInNext, container, parentComponent, parentAnchor)
      } else {
        break
      }

      start++
    }

    // 右侧对比
    while (start <= e1 && start <= e2) {
      const vnodeInPrev = prevChildren[e1]
      const vnodeInNext = nextChildren[e2]

      if (isSameVnode(vnodeInPrev, vnodeInNext)) {
        patch(vnodeInPrev, vnodeInNext, container, parentComponent, parentAnchor)
      } else {
        break
      }
      e1--
      e2--
    }

    // 新节点比老节点多，创建新节点
    if (start > e1) {
      if (start <= e2) {
        const nextPos = start + 1
        const anchor = nextPos < l2 ? nextChildren[nextPos].el : null
        while (start <= e2) {
          patch(null, nextChildren[start], container, parentComponent, anchor)
          start++
        }
      }
    } else if (start > e2) {
      // 新节点比老节点少，删除老节点
      while (start <= e1) {
        hostRemove(prevChildren[start].el)
        start++
      }
    } else {
      // 中间不同部分
      let s1 = start
      let s2 = start

      const toBePatched = e2 - s2 + 1 // 新节点的数量
      let patched = 0 // 已经处理好的新节点数量
      const keyToNewIndexMap = new Map()
      // 相同的节点在新节点中的位置映射老节点中的位置
      const newIndexToOldIndexMap = new Array(toBePatched)
      let moved = false // 新老节点中的元素是否改变了顺序
      let maxNewIndexSoFar = 0

      // 初始化newIndexToOldIndexMap，全部元素为0
      for (let i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0
      //newIndexToOldIndexMap.forEach(item => item = 0)

      for (let i = s2; i <= e2; i++) {
        const nextChild = nextChildren[i]
        // 新的虚拟节点的key属性作为索引
        keyToNewIndexMap.set(nextChild.key, i)
      }

      // 检查老vnode是否在新的vnode中还依然存在
      for (let i = s1; i <= e1; i++) {
        const prevChild = prevChildren[i]

        // 新节点已经全部遍历处理完成，后续老节点不在需要
        if (patched >= toBePatched) {
          hostRemove(prevChild.el)
          continue
        }

        let newIndex // newVnode在nextChildren中的索引
        if (prevChild.key != null) {
          // null undefined
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          // 虚拟节点没有key属性，遍历查找
          for (let j = s2; j <= e2; j++) {
            if (isSameVnode(prevChild, nextChildren[j])) {
              newIndex = j
              break
            }
          }
        }

        if (newIndex === undefined) {
          // 老节点不存在了
          hostRemove(prevChild.el)
        } else {
          // 老节点还存在
          if (newIndex >= maxNewIndexSoFar) {
            // 相同的节点在新老家节点中的位置未改变
            maxNewIndexSoFar = newIndex
          } else {
            // 相同的节点在新老家节点中的位置改变了
            moved = true
          }

          // newIndexToOldIndexMap新节点在老节点中的位置
          // 因为newIndexToOldIndexMap的长度是中间不同部分的长度，需要减去新节点中相同部分的长度作为索引
          // i+1老节点的索引加一是为了避免对应值为0，因为0代表新节点不存在于老节点中，待创建
          newIndexToOldIndexMap[newIndex - s2] = i + 1 
          // 深度对比新老节点的子节点
          patch(prevChild, nextChildren[newIndex], container, parentComponent, null)
          patched++ // 相同节点在新节点中存在才会加一
        }
      }

      // 根据新老节点的对应关系找到一个最长递增子序列
      // 该序列表示对于新接节点对于老节点来说，相对顺序不变的部分
      const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : []
      let j = increasingNewIndexSequence.length - 1

      for (let i = toBePatched - 1; i >= 0; i--) {
        // 因为用insertBefroe插入节点，所以需要倒叙
        const nextIndex = i + s2 // 因为i取自toBepatched的长度，需要补全新节点数组前面不变的的长度
        const nextChild = nextChildren[nextIndex]
        const anchor = nextIndex + 1 < l2 ? nextChildren[nextIndex + 1].el : null
      
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, parentComponent, anchor)
        } else if (moved) {
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            // 新节点元素相对于老节点改变了
            console.log('移动位置')
            hostInsert(nextChild.el, container, anchor)
          } else {
            j--
          }
        }
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

  function mountElement (vnode, container, parentComponent, anchor) {
    const el = (vnode.el = hostCreateElement(vnode.type))

    const { children, props, shapeFlag } = vnode

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode.children, el, parentComponent, anchor)
    }
    // 是否需要处理SLOT_CHILDREN

    for (const key in props) {
      const val = props[key]
      hostPatchProp(el, key, null, val)
    }

    // container.append(el)
    hostInsert(el, container, anchor)
  }

  function mountChildren (children, container, parentComponent, anchor) {
    children.forEach((v) => {
      patch(null, v, container, parentComponent, anchor)
    })
  }

  function processComponent(oldVnode, newVnode, container, parentComponent, anchor) {
    if (!oldVnode) {
      mountComponent(newVnode, container, parentComponent, anchor)
    } else {
      updateComponent(oldVnode, newVnode)
    }
  }

  function updateComponent(oldVnode, newVnode) {
    const instance = (newVnode.component = oldVnode.component)
    if (shouldUpdateComponent(oldVnode, newVnode)) {
      // 新旧虚拟节点的props有变化
      instance.next = newVnode
      instance.update()
    } else {
      newVnode.el = oldVnode.el
      instance.vnode = newVnode
    }
  }

  function mountComponent(initialVnode, container, parentComponent, anchor) {
    // 根据组件对象(vnode.type)创建组件实例
    // 组件的vnode属性就是用组件自己创建的createVnode
    // type属性就是组件文件本身
    const instance = (initialVnode.component = createComponentInstance(initialVnode, parentComponent))

    // 在组件实例上挂载属性(props render...)，完善组件实例
    setupComponent(instance)
    setupRenderEffect(instance, initialVnode, container, anchor)
  }

  // 组件的初始化调用该函数
  function setupRenderEffect(instance, initialVnode, container, anchor) {
    instance.update = effect(() => {
      if (!instance.isMounted) {
        const  { proxy } = instance
        // 组件实例调用组件对象的render函数(App.js)
        // 绑定代理对象后render可以获取到在组件上挂载(setupComponent的工作)的各项属性
        // 相当于在template上使用data中的变量， instance.render.call(proxy)返回的等于该组件的template标签中的内容
        instance.subTree = instance.render.call(proxy, proxy) // 虚拟节点
        const subTree = instance.subTree

        patch(null, subTree, container, instance, anchor)

        // 该组件的子组件和子元素都挂载(mounted)完成后，挂载根元素
        // 组件实例正在使用的根 DOM 元素。
        initialVnode.el = subTree.el
        instance.isMounted = true
      } else {
        // 获取组件的新老虚拟节点，更新老节点的数据
        const { next, vnode } = instance
        if (next) {
          next.el = vnode.el
          updateComponentPreRender(instance, next)
        }

        const {
          proxy,
          subTree: prevSubTree
        } = instance
        instance.subTree = instance.render.call(proxy, proxy)
        const subTree = instance.subTree

        patch(prevSubTree, subTree, container, instance, anchor)
      }
    }, {
      scheduler() {
        queueJobs(instance.update)
      }
    })
  }

  return {
    // createAppAPI 返回一个函数，render函数在该函数的闭包中
    // 函数接受根组件作为参数，返回一个有mount方法的对象
    createApp: createAppAPI(render)
  }
}

// 更新组件上的属性，在调用render函数前
function updateComponentPreRender(instance, nextVnode) {
  instance.vnode = nextVnode
  instance.next = null
  instance.props = nextVnode.props
}

// 最长递增子序列
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = (u + v) >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}