'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const Fragment = Symbol("Fragment");
const Text = Symbol("Text");
function createVNode(type, props, children) {
    // type 可能是一个对象，也是一个组件
    // 可能由h函数调用该函数，type就是字符串，根据type, props, children生成真实节点
    const vnode = {
        type,
        props,
        children,
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

function renderSlots(slots, name, props) {
    // slots一般是组件实例的$slots
    const slot = slots[name];
    if (slot) {
        if (typeof slot === "function") {
            return createVNode(Fragment, {}, slot(props));
        }
    }
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
    $slots: (i) => i.slots
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
        slots[key] = (props) => normalizeSlotValue(value(props));
    }
}
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
        subTree: {},
        emit: () => { }
    };
    // 将组件自身实例传递给emit函数，在emit函数内查看props上的绑定事件
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    // 创建虚拟节点时的props应该作为组件的setup函数参数传入
    //将props挂载到组件的setupState属性上，就可以用过代理获取值了
    initProps(instance, instance.vnode.props); // 将虚拟节点的props挂载到组件实例上
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
        setCurrentInstance(instance); // 该变量在setup函数的闭包中
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
    if (Component.render) {
        instance.render = Component.render;
    }
}
let currentInstance = null;
// 只能在setup和生命周期函数中使用
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(instance) {
    currentInstance = instance;
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
            mount(rootContainer) {
                const vnode = createVNode(rootComponent);
                render(vnode, rootContainer);
            }
        };
    };
}

function createRenderer(options) {
    const { createElement: hostCreateElement, patchProp: hostPatchProp, insert: hostInsert, remove: hostRemove, setElementText: hostSetElementText } = options;
    // render通过一系列的调用其它函数将vnode挂载到真实节点container下
    // 区别于组件中的render
    function render(vnode, container) {
        patch(null, vnode, container, null);
    }
    function patch(oldVnode, newVnode, container, parentComponent) {
        const { type, shapeFlag } = newVnode;
        switch (type) {
            case Fragment:
                processFragment(oldVnode, newVnode, container, parentComponent);
                break;
            case Text:
                processText(oldVnode, newVnode, container);
                break;
            default:
                // Fragment -> 只渲染children
                if (shapeFlag & 1 /* ELEMENT */) {
                    // element类型创建dom元素
                    processElement(oldVnode, newVnode, container, parentComponent);
                }
                else if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
                    // 当vnode.type为组件对象时，例如createApp创建根组件时
                    processComponent(oldVnode, newVnode, container, parentComponent);
                }
        }
    }
    function processText(oldVnode, newVnode, container) {
        const { children } = newVnode;
        const textNode = (newVnode.el = document.createTextNode(children));
        container.append(textNode);
    }
    function processFragment(oldVnode, newVnode, container, parentComponent) {
        mountChildren(newVnode.children, container, parentComponent);
    }
    function processElement(oldVnode, newVnode, container, parentComponent) {
        if (!oldVnode) {
            mountElement(newVnode, container, parentComponent);
        }
        else {
            patchElement(oldVnode, newVnode, container, parentComponent);
        }
    }
    function patchElement(oldVnode, newVnode, container, parentComponent) {
        const oldProps = oldVnode.props || EMPTY_OBJ;
        const newProps = newVnode.props || EMPTY_OBJ;
        const el = (newVnode.el = oldVnode.el);
        patchChildren(oldVnode, newVnode, container, parentComponent);
        patchProps(el, oldProps, newProps);
    }
    function patchChildren(oldVnode, newVnode, container, parentComponent) {
        const { shapeFlag: prevShapeFlag, children: prevChildren } = oldVnode; //n1 
        const { shapeFlag, children: nextChildren } = newVnode; //n2
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            if (prevShapeFlag & 8 /* ARRAY_CHILDREN */) {
                // 清空原children
                unmountChildren(oldVnode.children);
            }
            if (prevChildren !== nextChildren) {
                hostSetElementText(container, nextChildren);
            }
        }
        else {
            // 更新的节点是一个数组
            if (prevShapeFlag & 4 /* TEXT_CHILDREN */) {
                hostSetElementText(container, "");
                console.log(newVnode);
                console.log(nextChildren);
                mountChildren(nextChildren, container, parentComponent);
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
    function mountElement(vnode, container, parentComponent) {
        const el = (vnode.el = hostCreateElement(vnode.type));
        const { children, props, shapeFlag } = vnode;
        if (shapeFlag & 4 /* TEXT_CHILDREN */) {
            el.textContent = children;
        }
        else if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
            mountChildren(vnode.children, el, parentComponent);
        }
        // 是否需要处理SLOT_CHILDREN
        for (const key in props) {
            const val = props[key];
            hostPatchProp(el, key, null, val);
        }
        // container.append(el)
        hostInsert(el, container);
    }
    function mountChildren(children, container, parentComponent) {
        console.log(children);
        children.forEach((v) => {
            patch(null, v, container, parentComponent);
        });
    }
    function processComponent(oldVnode, newVnode, container, parentComponent) {
        mountComponent(newVnode, container, parentComponent);
    }
    function mountComponent(initialVnode, container, parentComponent) {
        // 根据组件对象(vnode.type)创建组件实例
        // 组件的vnode属性就是用组件自己创建的createVnode
        // type属性就是组件文件本身
        const instance = createComponentInstance(initialVnode, parentComponent);
        // 在组件实例上挂载属性(props render...)，完善组件实例
        setupComponent(instance);
        setupRenderEffect(instance, initialVnode, container);
    }
    // 组件的初始化调用该函数
    function setupRenderEffect(instance, initialVnode, container) {
        effect(() => {
            if (!instance.isMounted) {
                const { proxy } = instance;
                // 组件实例调用组件对象的render函数(App.js)
                // 绑定代理对象后render可以获取到在组件上挂载(setupComponent的工作)的各项属性
                // 相当于在template上使用data中的变量， instance.render.call(proxy)返回的等于该组件的template标签中的内容
                instance.subTree = instance.render.call(proxy);
                const subTree = instance.subTree;
                patch(null, subTree, container, instance);
                // 该组件的子组件和子元素都挂载(mounted)完成后，挂载根元素
                // 组件实例正在使用的根 DOM 元素。
                initialVnode.el = subTree.el;
                instance.isMounted = true;
            }
            else {
                console.log('update');
                const { proxy, subTree: prevSubTree } = instance;
                instance.subTree = instance.render.call(proxy);
                const subTree = instance.subTree;
                patch(prevSubTree, subTree, container, instance);
            }
        });
    }
    return {
        createApp: createAppAPI(render)
    };
}

// 基于dom的渲染接口
function createElement(type) {
    return document.createElement(type);
}
function patchProp(el, key, prevVal, nextVal) {
    if (isOn(key)) {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, nextVal);
    }
    else {
        console.log('nextval is undefined');
        if (nextVal === undefined || nextVal === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, nextVal);
        }
    }
}
function insert(el, parent) {
    parent.append(el);
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

function h(type, props, children) {
    return createVNode(type, props, children);
}

exports.createApp = createApp;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.provide = provide;
exports.proxyRefs = proxyRefs;
exports.ref = ref;
exports.renderSlots = renderSlots;
