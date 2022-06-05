const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
function createVNode(type, props, children) {
    // type 可能是一个对象，也是一个组件
    // 可能由h函数调用该函数，type就是字符串，根据type, props, children生成真实节点
    const vnode = {
        type,
        props,
        children,
        component: null,
        key: props && props.key,
        shapeFlag: getShapeFlag(type),
        el: null // 该vnode对应的dom节点
    };
    // children
    if (typeof children === "string") {
        vnode.shapeFlag |= 4 /* TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ARRAY_CHILDREN */;
    }
    if (vnode.shapeFlag & 2 /* STATEFUL_COMPONENT */) {
        // 判断条件可能不是很准确，object太宽泛
        if (typeof children === "object") {
            vnode.shapeFlag |= 16 /* SLOT_CHILDREN */;
        }
    }
    return vnode;
}
// 创建文本节点对应的虚拟节点
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}
function getShapeFlag(type) {
    return typeof type === "string" ? 1 /* ELEMENT */ : 2 /* STATEFUL_COMPONENT */;
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

function renderSlots(slots, name, props) {
    // slots一般是组件实例的$slots
    const slot = slots[name];
    if (slot) {
        if (typeof slot === "function") {
            return createVNode(Fragment, {}, slot(props));
        }
    }
}

function toDisplayString(value) {
    return String(value);
}

const extend = Object.assign;
const isObject = (val) => {
    return val !== null && typeof val === "object";
};
const hasChanged = (value1, value2) => {
    return !Object.is(value1, value2);
};
const isOn = (key) => {
    return /^on[A-Z]/.test(key);
};
const isString = (value) => {
    return typeof value === 'string';
};
const hasOwnProperty = (obj, key) => {
    return Object.prototype.hasOwnProperty.call(obj, key);
};
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
const toHandlerKey = (str) => {
    return str ? "on" + capitalize(str) : "";
};
const camelize = (str) => {
    return str.replace(/-(\w)/g, (_, c) => {
        return c ? c.toUpperCase() : "";
    });
};
const EMPTY_OBJ = {};

const publicPropertiesMap = {
    $el: (i) => i.vnode.el,
    $slots: (i) => i.slots,
    $props: (i) => i.props
};
const PublicInstanceProxyHandlers = {
    // 从代理对象结构_，命名为instance
    get({ _: instance }, key) {
        const { setupState, props } = instance;
        if (hasOwnProperty(setupState, key)) {
            return Reflect.get(setupState, key);
        }
        else if (hasOwnProperty(props, key)) {
            return Reflect.get(props, key);
        }
        const publicGetter = publicPropertiesMap[key];
        if (publicGetter) {
            return publicGetter(instance);
        }
    }
};

// 将props挂载到组件实例上
function initProps(instance, rawProps) {
    instance.props = rawProps || {};
}

let activeEffect; // 当前正在被触发的响应式逻辑
let shouldTrack; // 是否收集依赖
const targetMap = new Map();
// 收集响应式数据发生变化时的依赖(fn，用户定义的逻辑)
class ReactiveEffect {
    constructor(_fn, scheduler) {
        this.scheduler = scheduler;
        this.deps = [];
        this.active = true; // 标记effect是否被stop
        this._fn = _fn;
        this.scheduler = scheduler;
    }
    run() {
        if (!this.active) {
            return this._fn();
        }
        shouldTrack = true;
        activeEffect = this;
        const result = this._fn();
        // 下一次的get中的track闭包中的shouldTrack是false
        shouldTrack = false;
        return result;
    }
    stop() {
        if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanupEffect(effect) {
    effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
}
function isTracking() {
    return shouldTrack && activeEffect !== undefined;
}
function track(target, key) {
    // 在没有使用effect且触发track时，activeEffect为undefined
    if (!isTracking())
        return;
    // map的映射关系是target(被代理的对象) -> key -> dep(依赖收集容器，类型是集合)
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    let deps = depsMap.get(key);
    if (!deps) {
        // 依赖收集中的依赖唯一
        deps = new Set();
        depsMap.set(key, deps);
    }
    // 将引用了activeEffect的依赖的应用添加到activeEffect的deps中
    // 这样在某个effect stop时可以直接在相同的引用中delete自身
    trackEffects(deps);
}
function trackEffects(deps) {
    if (deps.has(activeEffect))
        return;
    deps.add(activeEffect);
    activeEffect.deps.push(deps);
}
function trigger(target, key) {
    let depsMap = targetMap.get(target);
    let deps = depsMap.get(key);
    triggerEffects(deps);
}
function triggerEffects(deps) {
    for (const effect of deps) {
        // 有更新逻辑按照更新逻辑，无更新逻辑按照初始化逻辑
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    }
}
function effect(fn, options = {}) {
    // 在使用effect为响应式对象添加数据响应时的逻辑时，因为通常在fn中会有对响应式对象的get、set等操作
    // 必定会收集依赖和触发依赖(track trigger)
    // 在依赖收集过程中将target,key,fn建立映射关系，
    // 在触发依赖是通过映射关系找到对应的依赖
    const _effect = new ReactiveEffect(fn, options.scheduler);
    extend(_effect, options);
    _effect.run();
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
}

// get操作的处理逻辑相同，只需要生成一次
const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly = false, shallow = false) {
    return function (target, key) {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly; // 闭包
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        const res = Reflect.get(target, key);
        if (shallow) {
            return res;
        }
        if (isObject(res)) {
            // 代理嵌套对象
            return isReadonly ? readonly(res) : reactive(res);
        }
        // 依赖收集
        if (!isReadonly) {
            track(target, key);
        }
        return res;
    };
}
function createSetter() {
    return function (target, key, value) {
        const res = Reflect.set(target, key, value);
        // 触发依赖
        trigger(target, key);
        return res;
    };
}
const mutableHandlers = {
    get,
    set
};
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key, value) {
        console.warn(`key: ${key} is readonly`, target);
        return true;
    }
};
const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
});

function createReactiveObject(raw, baseHandlers) {
    if (!isObject(raw)) {
        console.warn(`target ${raw} 必须是一个对象`);
        return raw;
    }
    return new Proxy(raw, baseHandlers);
}
// 为一个对象创建代理，返回代理对象
function reactive(raw) {
    return createReactiveObject(raw, mutableHandlers);
}
function shallowReadonly(raw) {
    return createReactiveObject(raw, shallowReadonlyHandlers);
}
function readonly(raw) {
    return createReactiveObject(raw, readonlyHandlers);
}

function emit(instance, eventName, ...args) {
    // 需要在组件的props中查看是否有event对应的回调函数
    const { props } = instance;
    const camelizeName = camelize(eventName);
    const handlerName = toHandlerKey(capitalize(camelizeName));
    const handler = props[handlerName];
    handler && handler(...args);
}

function initSlots(instance, children) {
    const { vnode } = instance;
    if (vnode.shapeFlag & 16 /* SLOT_CHILDREN */) {
        normalizeObjectSlots(children, instance.slots);
    }
}
// 在组件实例的slots上根据对应的vnode的children添加键名相同的对象，参数是组件实例的props 
function normalizeObjectSlots(children, slots) {
    for (const key in children) {
        const value = children[key];
        // value(props)返回虚拟节点  
        slots[key] = (props) => normalizeSlotValue(value(props));
    }
}
// 透传数组
function normalizeSlotValue(value) {
    return Array.isArray(value) ? value : [value];
}

// proxy针对对象做代理，对于基础值来说应该用对象做响应式
class RefImpl {
    constructor(value) {
        this.__v_isRef = true;
        this._rawValue = value;
        // value如果是object类型，需要用reactivet包裹
        this._value = convert(value);
        this.dep = new Set();
    }
    get value() {
        trackRefValue(this);
        return this._value;
    }
    set value(newValue) {
        if (hasChanged(this._rawValue, newValue)) {
            this._rawValue = newValue;
            this._value = convert(newValue);
            // 触发依赖
            triggerEffects(this.dep);
        }
    }
}
// 如果被ref的值是一个对象，将它装换为reavtice并赋值给this._value
function convert(value) {
    return isObject(value) ? reactive(value) : value;
}
function trackRefValue(ref) {
    // 当使用effect时才有依赖需要收集
    if (isTracking()) {
        // 收集依赖
        trackEffects(ref.dep);
    }
}
function ref(value) {
    return new RefImpl(value);
}
function isRef(ref) {
    return !!ref.__v_isRef;
}
function unRef(ref) {
    // 如果参数是一个 ref，则返回内部值，否则返回参数本身
    return isRef(ref) ? ref.value : ref;
}
// 可以不通过ref.value的访问ref的值
function proxyRefs(objectWithRefs) {
    return new Proxy(objectWithRefs, {
        get(target, key) {
            // 针对target[key]为object且有属性为ref时
            // let res = unRef(Reflect.get(target, key))
            // if (isObject(res)) {
            //   return proxyRefs(res)
            // }
            // return res
            return unRef(Reflect.get(target, key));
        },
        set(target, key, value) {
            if (isRef(target[key]) && !isRef(value)) {
                return (target[key].value = value);
            }
            else {
                return Reflect.set(target, key, value);
            }
        }
    });
}

function createComponentInstance(vnode, parent) {
    const component = {
        vnode,
        type: vnode.type,
        props: {},
        setupState: {},
        slots: {},
        provides: parent ? parent.provides : {},
        parent,
        isMounted: false,
        next: null,
        subTree: {},
        emit: () => { }
    };
    // 将组件自身实例传递给emit函数，在emit函数内查看props上的绑定事件
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    // 创建虚拟节点时的props应该作为组件的setup函数参数传入
    // 将props挂载到组件的setupState属性上，就可以用过代理获取值了
    initProps(instance, instance.vnode.props); // 将虚拟节点的props挂载到组件实例上
    // 在组件实例的slots上根据对应的vnode的children添加键名相同的对象
    initSlots(instance, instance.vnode.children);
    // 区别于函数组件的创建方法
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
    // Component是组件对象本身
    const Component = instance.type;
    // 挂载代理对象
    instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
    // 组件对象上可能会有setup函数
    const { setup } = Component;
    if (setup) {
        // 该变量在setup函数的闭包中，该闭包保存了currentInstance
        setCurrentInstance(instance);
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit
        });
        setCurrentInstance(null);
        handleSetupResult(instance, setupResult);
    }
}
function handleSetupResult(instance, setupResult) {
    if (typeof setupResult === 'object') {
        instance.setupState = proxyRefs(setupResult);
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    // type属性就是组件对象本身
    const Component = instance.type;
    if (compiler && !Component.render) {
        // 用户自定义的render函数优先级最高
        if (Component.template) {
            Component.render = compiler(Component.template);
        }
    }
    instance.render = Component.render;
}
let currentInstance = null;
// 只能在setup和生命周期函数中使用
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(instance) {
    currentInstance = instance;
}
let compiler;
function registerRunTimeCompiler(_compiler) {
    compiler = _compiler;
}

function provide(key, value) {
    // 在setup中调用
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        let { provides } = currentInstance;
        const parentProvides = currentInstance.parent.provides;
        // 仅初始化执行
        if (provide === parentProvides) {
            // 通过原型链解决provide自底向上查找的过程
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        provides[key] = value;
    }
}
function inject(key, defaultValue) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        const parentProvides = currentInstance.parent.provides;
        if (key in parentProvides) {
            return parentProvides[key];
        }
        else if (defaultValue && typeof defaultValue === 'function') {
            return defaultValue();
        }
        else {
            return defaultValue;
        }
    }
}

function createAppAPI(render) {
    return function createApp(rootComponent) {
        return {
            // 通过闭包保存根组件rootCompoment
            mount(rootContainer) {
                const vnode = createVNode(rootComponent); // 组件也有对应的vnode
                render(vnode, rootContainer);
            }
        };
    };
}

function shouldUpdateComponent(oldVnode, newVnode) {
    const { props: oldProps } = oldVnode;
    const { props: newProps } = newVnode;
    for (const key in newProps) {
        if (newProps[key] !== oldProps[key]) {
            return true;
        }
    }
    return false;
}

const queue = [];
let isFlushPending = false;
const p = Promise.resolve();
function nextTick(fn) {
    return fn ? p.then(fn) : p;
}
function queueJobs(job) {
    if (!queue.includes(job)) {
        queue.push(job);
    }
    queueFlush();
}
function queueFlush() {
    // 仅创建一次微任务执行组件更新
    if (isFlushPending)
        return;
    isFlushPending = true;
    nextTick(flushJobs);
}
function flushJobs() {
    isFlushPending = false;
    let job;
    while ((job = queue.shift())) {
        job && job();
    }
}

function createRenderer(options) {
    // 用户可以自定义以下函数，实现自定义的渲染函数
    const { createElement: hostCreateElement, // 创建dom元素
    patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText } = options;
    // render通过一系列的调用其它函数将vnode挂载到真实节点container下
    // 区别于组件中的render
    function render(vnode, container) {
        patch(null, vnode, container, null, null);
    }
    function patch(oldVnode, newVnode, container, parentComponent, anchor) {
        const { type, shapeFlag } = newVnode;
        switch (type) {
            case Fragment:
                // Fragment类型的组件忽略父组件，将父组件中的内容直接挂载到container中
                processFragment(oldVnode, newVnode, container, parentComponent, anchor);
                break;
            case Text:
                // 处理文本类型的节点
                processText(oldVnode, newVnode, container);
                break;
            default:
                // Fragment -> 只渲染children
                if (shapeFlag & 1 /* ELEMENT */) {
                    // element类型创建dom元素
                    processElement(oldVnode, newVnode, container, parentComponent, anchor);
                }
                else if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    // 当vnode.type为组件对象时，例如createApp创建根组件时
                    processComponent(oldVnode, newVnode, container, parentComponent, anchor);
                }
        }
    }
    function processText(oldVnode, newVnode, container) {
        const { children } = newVnode;
        const textNode = (newVnode.el = document.createTextNode(children));
        container.append(textNode);
    }
    function processFragment(oldVnode, newVnode, container, parentComponent, anchor) {
        mountChildren(newVnode.children, container, parentComponent, anchor);
    }
    function processElement(oldVnode, newVnode, container, parentComponent, anchor) {
        if (!oldVnode) {
            mountElement(newVnode, container, parentComponent, anchor);
        }
        else {
            patchElement(oldVnode, newVnode, container, parentComponent, anchor);
        }
    }
    function patchElement(oldVnode, newVnode, container, parentComponent, anchor) {
        const oldProps = oldVnode.props || EMPTY_OBJ;
        const newProps = newVnode.props || EMPTY_OBJ;
        const el = (newVnode.el = oldVnode.el);
        patchChildren(oldVnode, newVnode, el, parentComponent, anchor);
        patchProps(el, oldProps, newProps);
    }
    function patchChildren(oldVnode, newVnode, container, parentComponent, anchor) {
        const { shapeFlag: prevShapeFlag, children: prevChildren } = oldVnode; //n1 
        const { shapeFlag, children: nextChildren } = newVnode; //n2
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            if (prevShapeFlag & 8 /* ARRAY_CHILDREN */) {
                // 清空原children节点
                unmountChildren(oldVnode.children);
            }
            if (prevChildren !== nextChildren) {
                hostSetElementText(container, nextChildren);
            }
        }
        else {
            // 选虚拟节点children为数组，新的是文本
            if (prevShapeFlag & 4 /* TEXT_CHILDREN */) {
                hostSetElementText(container, "");
                mountChildren(nextChildren, container, parentComponent, anchor);
            }
            else {
                // array diff array
                patchKeyedChildren(prevChildren, nextChildren, container, parentComponent, anchor);
            }
        }
    }
    // diff
    function patchKeyedChildren(prevChildren, nextChildren, container, parentComponent, parentAnchor) {
        // 1 双端对比确定中间不同的节点的范围
        let start = 0; // i
        let l2 = nextChildren.length;
        let e1 = prevChildren.length - 1;
        let e2 = l2 - 1;
        function isSameVnode(vnode1, vnode2) {
            return vnode1.type === vnode2.type && vnode1.key === vnode2.key;
        }
        // 左右侧双端对比，确定中间的不同的范围
        // 左侧对比
        while (start <= e1 && start <= e2) {
            const vnodeInPrev = prevChildren[start];
            const vnodeInNext = nextChildren[start];
            if (isSameVnode(vnodeInPrev, vnodeInNext)) {
                // 相同节点复用老节点，复用节点的渲染效率更高
                patch(vnodeInPrev, vnodeInNext, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            start++;
        }
        // 右侧对比
        while (start <= e1 && start <= e2) {
            const vnodeInPrev = prevChildren[e1];
            const vnodeInNext = nextChildren[e2];
            if (isSameVnode(vnodeInPrev, vnodeInNext)) {
                patch(vnodeInPrev, vnodeInNext, container, parentComponent, parentAnchor);
            }
            else {
                break;
            }
            e1--;
            e2--;
        }
        // 新节点比老节点多，创建新节点
        if (start > e1) {
            if (start <= e2) {
                const nextPos = start + 1;
                const anchor = nextPos < l2 ? nextChildren[nextPos].el : null;
                while (start <= e2) {
                    patch(null, nextChildren[start], container, parentComponent, anchor);
                    start++;
                }
            }
        }
        else if (start > e2) {
            // 新节点比老节点少，删除老节点
            while (start <= e1) {
                hostRemove(prevChildren[start].el);
                start++;
            }
        }
        else {
            // 中间不同部分
            let s1 = start;
            let s2 = start;
            const toBePatched = e2 - s2 + 1; // 新节点的数量
            let patched = 0; // 已经处理好的新节点数量
            const keyToNewIndexMap = new Map();
            // 相同的节点在新节点中的位置映射老节点中的位置
            const newIndexToOldIndexMap = new Array(toBePatched);
            let moved = false; // 新老节点中的元素是否改变了顺序
            let maxNewIndexSoFar = 0;
            // 初始化newIndexToOldIndexMap，全部元素为0
            for (let i = 0; i < toBePatched; i++)
                newIndexToOldIndexMap[i] = 0;
            //newIndexToOldIndexMap.forEach(item => item = 0)
            for (let i = s2; i <= e2; i++) {
                const nextChild = nextChildren[i];
                // 新的虚拟节点的key属性作为索引
                keyToNewIndexMap.set(nextChild.key, i);
            }
            // 检查老vnode是否在新的vnode中还依然存在
            for (let i = s1; i <= e1; i++) {
                const prevChild = prevChildren[i];
                // 新节点已经全部遍历处理完成，后续老节点不在需要
                if (patched >= toBePatched) {
                    hostRemove(prevChild.el);
                    continue;
                }
                let newIndex; // newVnode在nextChildren中的索引
                if (prevChild.key != null) {
                    // null undefined
                    newIndex = keyToNewIndexMap.get(prevChild.key);
                }
                else {
                    // 虚拟节点没有key属性，遍历查找
                    for (let j = s2; j <= e2; j++) {
                        if (isSameVnode(prevChild, nextChildren[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                if (newIndex === undefined) {
                    // 老节点不存在了
                    hostRemove(prevChild.el);
                }
                else {
                    // 老节点还存在
                    if (newIndex >= maxNewIndexSoFar) {
                        // 相同的节点在新老家节点中的位置未改变
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
                        // 相同的节点在新老家节点中的位置改变了
                        moved = true;
                    }
                    // newIndexToOldIndexMap新节点在老节点中的位置
                    // 因为newIndexToOldIndexMap的长度是中间不同部分的长度，需要减去新节点中相同部分的长度作为索引
                    // i+1老节点的索引加一是为了避免对应值为0，因为0代表新节点不存在于老节点中，待创建
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    // 深度对比新老节点的子节点
                    patch(prevChild, nextChildren[newIndex], container, parentComponent, null);
                    patched++; // 相同节点在新节点中存在才会加一
                }
            }
            // 根据新老节点的对应关系找到一个最长递增子序列
            // 该序列表示对于新接节点对于老节点来说，相对顺序不变的部分
            const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : [];
            let j = increasingNewIndexSequence.length - 1;
            for (let i = toBePatched - 1; i >= 0; i--) {
                // 因为用insertBefroe插入节点，所以需要倒叙
                const nextIndex = i + s2; // 因为i取自toBepatched的长度，需要补全新节点数组前面不变的的长度
                const nextChild = nextChildren[nextIndex];
                const anchor = nextIndex + 1 < l2 ? nextChildren[nextIndex + 1].el : null;
                if (newIndexToOldIndexMap[i] === 0) {
                    patch(null, nextChild, container, parentComponent, anchor);
                }
                else if (moved) {
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        // 新节点元素相对于老节点改变了
                        console.log('移动位置');
                        hostInsert(nextChild.el, container, anchor);
                    }
                    else {
                        j--;
                    }
                }
            }
        }
    }
    function unmountChildren(children) {
        for (let i = 0; i < children.length; i++) {
            const el = children[i].el;
            hostRemove(el);
        }
    }
    function patchProps(el, oldProps, newProps) {
        if (oldProps !== newProps) {
            for (const key in newProps) {
                const prevProp = oldProps[key];
                const nextProp = newProps[key];
                if (prevProp !== nextProp) {
                    hostPatchProp(el, key, prevProp, nextProp);
                }
            }
            if (oldProps !== EMPTY_OBJ) {
                for (const key in oldProps) {
                    if (!(key in newProps)) {
                        hostPatchProp(el, key, oldProps[key], null);
                    }
                }
            }
        }
    }
    function mountElement(vnode, container, parentComponent, anchor) {
        const el = (vnode.el = hostCreateElement(vnode.type));
        const { children, props, shapeFlag } = vnode;
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            el.textContent = children;
        }
        else if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            mountChildren(vnode.children, el, parentComponent, anchor);
        }
        // 是否需要处理SLOT_CHILDREN
        for (const key in props) {
            const val = props[key];
            hostPatchProp(el, key, null, val);
        }
        // container.append(el)
        hostInsert(el, container, anchor);
    }
    function mountChildren(children, container, parentComponent, anchor) {
        children.forEach((v) => {
            patch(null, v, container, parentComponent, anchor);
        });
    }
    function processComponent(oldVnode, newVnode, container, parentComponent, anchor) {
        if (!oldVnode) {
            mountComponent(newVnode, container, parentComponent, anchor);
        }
        else {
            updateComponent(oldVnode, newVnode);
        }
    }
    function updateComponent(oldVnode, newVnode) {
        const instance = (newVnode.component = oldVnode.component);
        if (shouldUpdateComponent(oldVnode, newVnode)) {
            // 新旧虚拟节点的props有变化
            instance.next = newVnode;
            instance.update();
        }
        else {
            newVnode.el = oldVnode.el;
            instance.vnode = newVnode;
        }
    }
    function mountComponent(initialVnode, container, parentComponent, anchor) {
        // 根据组件对象(vnode.type)创建组件实例
        // 组件的vnode属性就是用组件自己创建的createVnode
        // type属性就是组件文件本身
        const instance = (initialVnode.component = createComponentInstance(initialVnode, parentComponent));
        // 在组件实例上挂载属性(props render...)，完善组件实例
        setupComponent(instance);
        setupRenderEffect(instance, initialVnode, container, anchor);
    }
    // 组件的初始化调用该函数
    function setupRenderEffect(instance, initialVnode, container, anchor) {
        instance.update = effect(() => {
            if (!instance.isMounted) {
                const { proxy } = instance;
                // 组件实例调用组件对象的render函数(App.js)
                // 绑定代理对象后render可以获取到在组件上挂载(setupComponent的工作)的各项属性
                // 相当于在template上使用data中的变量， instance.render.call(proxy)返回的等于该组件的template标签中的内容
                instance.subTree = instance.render.call(proxy, proxy); // 虚拟节点
                const subTree = instance.subTree;
                patch(null, subTree, container, instance, anchor);
                // 该组件的子组件和子元素都挂载(mounted)完成后，挂载根元素
                // 组件实例正在使用的根 DOM 元素。
                initialVnode.el = subTree.el;
                instance.isMounted = true;
            }
            else {
                // 获取组件的新老虚拟节点，更新老节点的数据
                const { next, vnode } = instance;
                if (next) {
                    next.el = vnode.el;
                    updateComponentPreRender(instance, next);
                }
                const { proxy, subTree: prevSubTree } = instance;
                instance.subTree = instance.render.call(proxy, proxy);
                const subTree = instance.subTree;
                patch(prevSubTree, subTree, container, instance, anchor);
            }
        }, {
            scheduler() {
                queueJobs(instance.update);
            }
        });
    }
    return {
        // createAppAPI 返回一个函数，render函数在该函数的闭包中
        // 函数接受根组件作为参数，返回一个有mount方法的对象
        createApp: createAppAPI(render)
    };
}
// 更新组件上的属性，在调用render函数前
function updateComponentPreRender(instance, nextVnode) {
    instance.vnode = nextVnode;
    instance.next = null;
    instance.props = nextVnode.props;
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
                }
                else {
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

// 基于dom的渲染接口
function createElement(type) {
    return document.createElement(type);
}
// 更新dom元素的属性(标签的属性)
function patchProp(el, key, prevVal, nextVal) {
    if (isOn(key)) {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, nextVal);
    }
    else {
        if (nextVal === undefined || nextVal === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, nextVal);
        }
    }
}
// function insert(child, parent, anchor) {
//   parent.insertBefore(child, anchor || null);
// }
function insert(el, parent, anchor) {
    parent.insertBefore(el, anchor || null);
}
function remove(child) {
    // 从父节点移出当前子节点
    const parent = child.parentNode;
    if (parent) {
        parent.removeChild(child);
    }
}
function setElementText(el, text) {
    el.textContent = text;
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    remove,
    setElementText
});
function createApp(...args) {
    return renderer.createApp(...args);
}

var runtimeDom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    createApp: createApp,
    h: h,
    renderSlots: renderSlots,
    createTextVNode: createTextVNode,
    createElementVNode: createVNode,
    getCurrentInstance: getCurrentInstance,
    registerRunTimeCompiler: registerRunTimeCompiler,
    provide: provide,
    inject: inject,
    createRenderer: createRenderer,
    nextTick: nextTick,
    toDisplayString: toDisplayString,
    ref: ref,
    proxyRefs: proxyRefs
});

function baseParse(content) {
    // content是template模版内容
    const context = createParserContext(content);
    return createRoot(parseChildren(context, []));
}
function advanceBy(context, length) {
    context.source = context.source.slice(length);
}
// 创建ast树的根节点
function createRoot(children) {
    return {
        children,
        type: 4 /* ROOT */
    };
}
// 创建全局上下文对象
function createParserContext(content) {
    return {
        source: content
    };
}
function parseChildren(context, ancestors) {
    // ancestores存储正在解析的起始标签
    const nodes = []; // ast树的节点
    while (!isEnd(context, ancestors)) {
        let node;
        const s = context.source;
        if (s.startsWith("{{")) {
            node = parseInterpolation(context);
        }
        else if (s[0] === "<") {
            if (/[a-z]/i.test(s[1])) {
                node = parseElement(context, ancestors);
            }
        }
        // 文本节点
        if (!node) {
            node = parseText(context);
        }
        nodes.push(node);
    }
    return nodes;
}
function isEnd(context, ancestors) {
    const s = context.source;
    if (s.startsWith("</")) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
            const tag = ancestors[i].tag;
            if (startsWithEndTagOpen(s, tag)) {
                return true;
            }
        }
    }
    return !s;
}
// 处理插值表达式为ast树
function parseInterpolation(context) {
    const openDelimiter = "{{";
    const closeDelimiter = "}}";
    const closeIndex = context.source.indexOf(closeDelimiter, openDelimiter.length);
    advanceBy(context, openDelimiter.length);
    const rawContentLength = closeIndex - openDelimiter.length;
    const rawCcontent = parseTextData(context, rawContentLength);
    const content = rawCcontent.trim();
    advanceBy(context, closeDelimiter.length);
    return {
        type: 0 /* INTERPOLATION */,
        content: {
            type: 1 /* SIMPLE_EXPRESSION */,
            content: content
        }
    };
}
function parseElement(context, ancestors) {
    const element = parseTag(context, 0 /* Start */);
    ancestors.push(element);
    element.children = parseChildren(context, ancestors);
    ancestors.pop();
    // 开始标签与结束标签是否一致
    if (startsWithEndTagOpen(context.source, element.tag)) {
        parseTag(context, 1 /* End */);
    }
    else {
        throw new Error(`lack end tag: ${element.tag}`);
    }
    return element;
}
function startsWithEndTagOpen(source, tag) {
    return source.startsWith("</") && source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase();
}
function parseTag(context, type) {
    // 解析tag
    const match = /^<\/?([a-z]*)/i.exec(context.source);
    const tag = match[1];
    // 删除解析后的代码
    advanceBy(context, match[0].length);
    // 删除">"
    advanceBy(context, 1);
    if (type === 1 /* End */)
        return;
    return {
        type: 2 /* ELEMENT */,
        tag
    };
}
function parseText(context) {
    let endIndex = context.source.length;
    let endTokens = ["{{", "<"];
    for (let i = 0; i < endTokens.length; i++) {
        const index = context.source.indexOf(endTokens[i]);
        if (index !== -1 && endIndex > index) {
            endIndex = index;
        }
    }
    // 获取content
    const content = parseTextData(context, endIndex);
    return {
        type: 3 /* TEXT */,
        content
    };
}
function parseTextData(context, length) {
    const content = context.source.slice(0, length);
    advanceBy(context, length);
    return content;
}

const TO_DISPLAY_STRING = Symbol("toDisplayString");
const CREATE_ELEMENT_VNODE = Symbol("createElementVNode");
const helperMapName = {
    [TO_DISPLAY_STRING]: "toDisplayString",
    [CREATE_ELEMENT_VNODE]: "createElementVNode"
};

function transform(root, options = {}) {
    const context = createTransformContext(root, options);
    // 1 dfs ast树
    traverseNode(root, context);
    // 创建一个入口节点，codegen根据这个入口节点生成render函数
    createRootCodegen(root);
    // ast根节点添加属性
    root.helpers = [...context.helpers.keys()];
}
function createRootCodegen(root) {
    const child = root.children[0];
    if (child.type === 2 /* ELEMENT */) {
        root.codegenNode = child.codegenNode;
    }
    else {
        root.codegenNode = root.children[0];
    }
}
function createTransformContext(root, options) {
    const context = {
        root,
        nodeTransforms: options.nodeTransforms || [],
        helpers: new Map(),
        helper(key) {
            context.helpers.set(key, 1);
        }
    };
    return context;
}
function traverseNode(node, context) {
    const nodeTransforms = context.nodeTransforms;
    const exitFns = [];
    for (const fn of nodeTransforms) {
        // 根据外部插件处理节点
        const onExit = fn(node, context);
        if (onExit)
            exitFns.push(onExit);
    }
    switch (node.type) {
        case 0 /* INTERPOLATION */:
            context.helper(TO_DISPLAY_STRING);
            break;
        case 4 /* ROOT */:
        case 2 /* ELEMENT */:
            traverseChildren(node, context);
            break;
    }
    // 插件先正序调用在倒序待调用
    let i = exitFns.length;
    while (i--) {
        exitFns[i]();
    }
}
function traverseChildren(node, context) {
    const children = node.children;
    for (const child of children) {
        traverseNode(child, context);
    }
}

// 处理插值表达式中的simpleexpression的插件
function transformExpression(node) {
    if (node.type === 0 /* INTERPOLATION */) {
        node.content = processExpression(node.content);
    }
}
function processExpression(node) {
    node.content = `_ctx.${node.content}`; // simpleexpress前加上_ctx
    return node;
}

function createVNodeCall(context, tag, props, children) {
    context.helper(CREATE_ELEMENT_VNODE);
    return {
        type: 2 /* ELEMENT */,
        tag,
        props,
        children
    };
}

function transformElement(node, context) {
    if (node.type === 2 /* ELEMENT */) {
        return () => {
            const vnodeTag = `'${node.tag}'`;
            let vnodeProps;
            const children = node.children;
            let vnodeChildren = children[0];
            node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
        };
    }
}

// 当标签类型节点中有连续的文本或插值表达式类型节点，将他们组成复合类型
function transformText(node) {
    function isText(node) {
        return (node.type === 3 /* TEXT */ || node.type === 0 /* INTERPOLATION */);
    }
    if (node.type === 2 /* ELEMENT */) {
        return () => {
            const { children } = node;
            let currentContainer;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (isText(child)) {
                    // 如果当前节点类型为文本或插值表达式类型，检查下一个节点
                    for (let j = i + 1; j < children.length; j++) {
                        const next = children[j];
                        if (isText(next)) {
                            // 连续的文本或插值表达式类型节点，用复合节点类型替换
                            if (!currentContainer) {
                                // 初始化currentContainer
                                // 用复合节点替换连续的文本或插值表达式类型节点中的第一个节点
                                currentContainer = children[i] = {
                                    type: 5 /* COMPOUND */,
                                    children: [child]
                                };
                            }
                            currentContainer.children.push(" + ");
                            currentContainer.children.push(next);
                            children.splice(j, 1);
                            j--;
                        }
                        else {
                            // 不是连续的文本或插值表达式类型节点，返回
                            currentContainer = null;
                            break;
                        }
                    }
                }
            }
        };
    }
}

function generate(ast) {
    const context = createCodegenContext();
    const { push } = context;
    genFunctionPreamble(ast, context);
    const functionName = "render";
    const args = ["_ctx", "_cache"];
    const signature = args.join(",");
    push(`function ${functionName}(${signature}) {`);
    push(`return `);
    genNode(ast.codegenNode, context);
    push("}");
    return {
        code: context.code,
    };
}
function createCodegenContext() {
    const context = {
        code: "",
        push(source) {
            context.code += source;
        },
        helper(key) {
            return `_${helperMapName[key]}`;
        }
    };
    return context;
}
// 生成函数返回内容
function genNode(node, context) {
    switch (node.type) {
        case 3 /* TEXT */:
            genText(context, node);
            break;
        case 0 /* INTERPOLATION */:
            genInterpolation(context, node);
            break;
        case 1 /* SIMPLE_EXPRESSION */:
            genExpression(node, context);
            break;
        case 2 /* ELEMENT */:
            genElement(node, context);
            break;
        case 5 /* COMPOUND */:
            genCompoundExpression(node, context);
            break;
    }
}
function genElement(node, context) {
    const { push, helper } = context;
    const { tag, children, props } = node;
    push(`${helper(CREATE_ELEMENT_VNODE)}(`);
    genNodeList(genNullable([tag, props, children]), context);
    // 处理ast子节点
    //genNode(children, context)
    push(")");
}
function genNodeList(nodes, context) {
    const { push } = context;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (isString(node)) {
            push(node);
        }
        else {
            genNode(node, context);
        }
        if (i < nodes.length - 1) {
            push(", ");
        }
    }
}
function genNullable(args) {
    return args.map((arg) => arg || "null");
}
// 生成导入逻辑
function genFunctionPreamble(ast, context) {
    const { push } = context;
    const VueBinging = "Vue";
    const aliasHelper = (s) => `${helperMapName[s]}: _${helperMapName[s]}`;
    if (ast.helpers.length > 0) {
        // 有需要导入的函数
        push(`const { ${ast.helpers.map(aliasHelper).join(", ")} } = ${VueBinging}`);
    }
    push("\n");
    push("return ");
}
// ast节点类型为text节点时需要返回的内容
function genText(context, node) {
    const { push } = context;
    push(`'${node.content}'`);
}
function genInterpolation(context, node) {
    const { push, helper } = context;
    push(`${helper(TO_DISPLAY_STRING)}(`);
    // 处理插值ast节点的simpleexpression节点
    genNode(node.content, context);
    push(")");
}
function genExpression(node, context) {
    const { push } = context;
    push(`${node.content}`);
}
function genCompoundExpression(node, context) {
    const { push } = context;
    const children = node.children;
    for (const child of children) {
        if (isString(child)) {
            push(child);
        }
        else {
            genNode(child, context);
        }
    }
}

// template编译成render函数
function baseCompile(template) {
    const ast = baseParse(template);
    transform(ast, {
        nodeTransforms: [transformExpression, transformElement, transformText]
    });
    return generate(ast);
}

function compileToFunction(template) {
    // code是函数的字符串
    const { code } = baseCompile(template);
    const render = new Function("Vue", code)(runtimeDom);
    return render;
}
// registerRunTimeCompiler该函数的作用域中有全局变量
registerRunTimeCompiler(compileToFunction);

export { createApp, createVNode as createElementVNode, createRenderer, createTextVNode, getCurrentInstance, h, inject, nextTick, provide, proxyRefs, ref, registerRunTimeCompiler, renderSlots, toDisplayString };
