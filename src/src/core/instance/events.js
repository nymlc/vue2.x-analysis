/* @flow */

import {
    tip,
    toArray,
    hyphenate,
    handleError,
    formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents(vm: Component) {
    // 存储的是自定义事件
    vm._events = Object.create(null)
    vm._hasHookEvent = false
    // init parent attached events
    // _parentListeners在/core/instance/init.js的initInternalComponent方法给赋了值
    // 其来源于父VNode，而VNode来自于/core/vdom/create-component.js createComponent方法new VNode时传入的data.on
    // data.on存储的是自定义事件，data.nativeOn存储的是原生浏览器事件
    // 也就是_parentListeners存储的是父组件绑定的非原生浏览器事件
    const listeners = vm.$options._parentListeners
    if (listeners) {
        // 存在的话就更新组件事件
        // 其实这里是发布订阅模式
        updateComponentListeners(vm, listeners)
    }
}

let target: any

function add(event, fn, once) {
    if (once) {
        target.$once(event, fn)
    } else {
        target.$on(event, fn)
    }
}

function remove(event, fn) {
    target.$off(event, fn)
}

export function updateComponentListeners(
    vm: Component,
    listeners: Object,
    oldListeners: ?Object
) {
    // 存储当前事件发生的组件实例对象
    target = vm
    // 更新事件
    updateListeners(listeners, oldListeners || {}, add, remove, vm)
    target = undefined
}
// 混入事件方法
// 其实这里是发布订阅模式，_events就是事件中心，事件都存储在此
export function eventsMixin(Vue: Class<Component>) {
    // 用于检测是否是hook事件
    const hookRE = /^hook:/
    Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
        const vm: Component = this
        // this.$on(['test1', 'test2'], function() {  })
        if (Array.isArray(event)) {
            for (let i = 0, l = event.length; i < l; i++) {
                this.$on(event[i], fn)
            }
        } else {
            // 事件入队
            (vm._events[event] || (vm._events[event] = [])).push(fn)
            // optimize hook:event cost by using a boolean flag marked at registration
            // instead of a hash lookup
            // 这里做个优化其实就是设置一个实例属性_hasHookEvent，只要判断到这个实例对象有注册了hook事件就置为true
            // 这样子就可以在callHook(vm, 'beforeCreate')之类时不用callHook(vm, 'hook:beforeCreate')，只要在callHook判断下_hasHookEvent然后加个前缀即可
            if (hookRE.test(event)) {
                vm._hasHookEvent = true
            }
        }
        return vm
    }

    Vue.prototype.$once = function (event: string, fn: Function): Component {
        const vm: Component = this
        // 劫持下下回调
        function on() {
            // 这就是$once的秘密，它在回调触发之后就会$off
            vm.$off(event, on)
            fn.apply(vm, arguments)
        }
        on.fn = fn
        vm.$on(event, on)
        return vm
    }

    Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
        const vm: Component = this
        // all
        // this.$off()
        if (!arguments.length) {
            vm._events = Object.create(null)
            return vm
        }
        // array of events
        // this.$off(['test1', 'test2'], fn)
        if (Array.isArray(event)) {
            for (let i = 0, l = event.length; i < l; i++) {
                this.$off(event[i], fn)
            }
            return vm
        }
        // specific event
        const cbs = vm._events[event]
        // 时间不存在
        if (!cbs) {
            return vm
        }
        // 要取消的回调不存在
        if (!fn) {
            vm._events[event] = null
            return vm
        }
        if (fn) {
            // specific handler
            let cb
            let i = cbs.length
            while (i--) {
                cb = cbs[i]
                // cb.fn其实是给$once使用的
                // 这里就是判断下要退订的fn和已注册的是否一致
                if (cb === fn || cb.fn === fn) {
                    cbs.splice(i, 1)
                    break
                }
            }
        }
        return vm
    }

    Vue.prototype.$emit = function (event: string): Component {
        const vm: Component = this
        if (process.env.NODE_ENV !== 'production') {
            const lowerCaseEvent = event.toLowerCase()
            // https://cn.vuejs.org/v2/guide/components-custom-events.html#%E4%BA%8B%E4%BB%B6%E5%90%8D
            // 这里其实是事件名kebab-case vs camelCase 或 PascalCase
            // 也就是HTML不区分大小写，所以建议使用kebab-case而不是驼峰命名法
            if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
                tip(
                    `Event "${lowerCaseEvent}" is emitted in component ` +
                    `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
                    `Note that HTML attributes are case-insensitive and you cannot use ` +
                    `v-on to listen to camelCase events when using in-DOM templates. ` +
                    `You should probably use "${hyphenate(event)}" instead of "${event}".`
                )
            }
        }
        // 取到事件回调
        let cbs = vm._events[event]
        if (cbs) {
            cbs = cbs.length > 1 ? toArray(cbs) : cbs
            // 取参数
            const args = toArray(arguments, 1)
            for (let i = 0, l = cbs.length; i < l; i++) {
                try {
                    cbs[i].apply(vm, args)
                } catch (e) {
                    handleError(e, vm, `event handler for "${event}"`)
                }
            }
        }
        return vm
    }
}
