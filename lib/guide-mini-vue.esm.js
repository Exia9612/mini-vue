function createVNode(type, props, children) {
    // type 可能是一个对象，也是一个组件
    // 可能由h函数调用该函数，type就是字符串，根据type, props, children生成真实节点
    var vnode = {
        type: type,
        props: props,
        children: children,
        shapeFlag: getShapeFlag(type),
        el: null
    };
    // children
    if (typeof children === "string") {
        vnode.shapeFlag |= 4 /* TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlag |= 8 /* ARRAY_CHILDREN */;
    }
    return vnode;
}
function getShapeFlag(type) {
    return typeof type === "string" ? 1 /* ELEMENT */ : 2 /* STATEFUL_COMPONENT */;
}

var extend = Object.assign;
var isObject = function (val) {
    return val !== null && typeof val === "object";
};
var isOn = function (key) {
    return /^on[A-Z]/.test(key);
};
var hasOwnProperty = function (obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
};
var capitalize = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
};
var toHandlerKey = function (str) {
    return str ? "on" + capitalize(str) : "";
};
var camelize = function (str) {
    return str.replace(/-(\w)/g, function (_, c) {
        return c ? c.toUpperCase() : "";
    });
};

var publicPropertiesMap = {
    $el: function (i) { return i.vnode.el; }
};
var PublicInstanceProxyHandlers = {
    // 从代理对象结构_，命名为instance
    get: function (_a, key) {
        var instance = _a._;
        var setupState = instance.setupState, props = instance.props;
        if (hasOwnProperty(setupState, key)) {
            return Reflect.get(setupState, key);
        }
        else if (hasOwnProperty(props, key)) {
            return Reflect.get(props, key);
        }
        var publicGetter = publicPropertiesMap[key];
        if (publicGetter) {
            return publicGetter(instance);
        }
    }
};

// 将props挂载到组件实例上
function initProps(instance, rawProps) {
    instance.props = rawProps || {};
}

var targetMap = new Map();
function trigger(target, key) {
    var depsMap = targetMap.get(target);
    var deps = depsMap.get(key);
    triggerEffects(deps);
}
function triggerEffects(deps) {
    for (var _i = 0, deps_1 = deps; _i < deps_1.length; _i++) {
        var effect_1 = deps_1[_i];
        // 有更新逻辑按照更新逻辑，无更新逻辑按照初始化逻辑
        if (effect_1.scheduler) {
            effect_1.scheduler();
        }
        else {
            effect_1.run();
        }
    }
}

// get操作的处理逻辑相同，只需要生成一次
var get = createGetter();
var set = createSetter();
var readonlyGet = createGetter(true);
var shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly, shallow) {
    if (isReadonly === void 0) { isReadonly = false; }
    if (shallow === void 0) { shallow = false; }
    return function (target, key) {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly; // 闭包
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        var res = Reflect.get(target, key);
        if (shallow) {
            return res;
        }
        if (isObject(res)) {
            // 代理嵌套对象
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
function createSetter() {
    return function (target, key, value) {
        var res = Reflect.set(target, key, value);
        // 触发依赖
        trigger(target, key);
        return res;
    };
}
var mutableHandlers = {
    get: get,
    set: set
};
var readonlyHandlers = {
    get: readonlyGet,
    set: function (target, key, value) {
        console.warn("key: " + key + " is readonly", target);
        return true;
    }
};
var shallowReadonlyHandlers = extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
});

function createReactiveObject(raw, baseHandlers) {
    if (!isObject(raw)) {
        console.warn("target " + raw + " \u5FC5\u987B\u662F\u4E00\u4E2A\u5BF9\u8C61");
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

function emit(instance, eventName) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    // 需要在组件的props中查看是否有event对应的回调函数
    var props = instance.props;
    var camelizeName = camelize(eventName);
    var handlerName = toHandlerKey(capitalize(camelizeName));
    var handler = props[handlerName];
    handler && handler.apply(void 0, args);
}

function createComponentInstance(vnode) {
    var component = {
        vnode: vnode,
        type: vnode.type,
        props: {},
        setupState: {},
        emit: function () { }
    };
    // 将组件自身实例传递给emit函数，在emit函数内查看props上的绑定事件
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance) {
    // 创建虚拟节点时的props应该作为组件的setup函数参数传入
    //将props挂载到组件的setupState属性上，就可以用过代理获取值了
    initProps(instance, instance.vnode.props); // 将props挂载到组件实例上
    // 区别于函数组件的创建方法
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance) {
    var Component = instance.type;
    // 挂载代理对象
    instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers);
    // 组件对象上可能会有setup函数
    var setup = Component.setup;
    if (setup) {
        var setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit
        });
        handleSetupResult(instance, setupResult);
    }
}
function handleSetupResult(instance, setupResult) {
    if (typeof setupResult === 'object') {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    var Component = instance.type;
    if (Component.render) {
        instance.render = Component.render;
    }
}

// render通过一系列的调用其它函数将vnode挂载到真实节点container下
// 区别于组件中的render
function render(vnode, container) {
    patch(vnode, container);
}
function patch(vnode, container) {
    var shapeFlag = vnode.shapeFlag;
    if (shapeFlag & 1 /* ELEMENT */) {
        // element类型创建dom元素
        processElement(vnode, container);
    }
    else if (shapeFlag & 2 /* STATEFUL_COMPONENT */) {
        // 当vnode.type为组件对象时，例如createApp创建根组件时
        processComponent(vnode, container);
    }
}
function processElement(vnode, container) {
    mountElement(vnode, container);
}
function mountElement(vnode, container) {
    var el = (vnode.el = document.createElement(vnode.type));
    var children = vnode.children, props = vnode.props, shapeFlag = vnode.shapeFlag;
    if (shapeFlag & 4 /* TEXT_CHILDREN */) {
        el.textContent = children;
    }
    else if (shapeFlag & 8 /* ARRAY_CHILDREN */) {
        mountChildren(vnode, el);
    }
    for (var key in props) {
        var val = props[key];
        if (isOn(key)) {
            var event_1 = key.slice(2).toLowerCase();
            el.addEventListener(event_1, val);
        }
        else {
            el.setAttribute(key, val);
        }
    }
    container.append(el);
}
function mountChildren(vnode, container) {
    vnode.children.forEach(function (v) {
        patch(v, container);
    });
}
function processComponent(vnode, container) {
    mountComponent(vnode, container);
}
function mountComponent(initialVnode, container) {
    // 根据组件对象(vnode.type)创建组件实例
    var instance = createComponentInstance(initialVnode);
    // 在组件实例上挂载属性(props render...)
    setupComponent(instance);
    setupRenderEffect(instance, initialVnode, container);
}
// 组件的初始化调用该函数
function setupRenderEffect(instance, initialVnode, container) {
    var proxy = instance.proxy;
    // 组件实例调用组件对象的render函数(App.js)
    // 绑定代理对象后render可以获取到在组件上挂载(setupComponent的工作)的各项属性
    var subTree = instance.render.call(proxy);
    patch(subTree, container);
    // 该组件的子组件和子元素都挂载(mounted)完成后，挂载根元素
    // 组件实例正在使用的根 DOM 元素。
    initialVnode.el = subTree.el;
}

function createApp(rootComponent) {
    return {
        mount: function (rootContainer) {
            var vnode = createVNode(rootComponent);
            render(vnode, rootContainer);
        }
    };
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

export { createApp, h };
