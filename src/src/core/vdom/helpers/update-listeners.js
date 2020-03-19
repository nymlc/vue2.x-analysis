/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'
// https://cn.vuejs.org/v2/guide/render-function.html#%E4%BA%8B%E4%BB%B6-amp-%E6%8C%89%E9%94%AE%E4%BF%AE%E9%A5%B0%E7%AC%A6
// 根据名字的修饰符解析出该事件各个修饰符情况
const normalizeEvent = cached((name: string): {
    name: string,
    once: boolean,
    capture: boolean,
    passive: boolean,
    handler?: Function,
    params?: Array<any>
} => {
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
        name,
        once,
        capture,
        passive
    }
})
// 高阶函数，就是接受一个事件回调然后返回一个函数
// 因为该事件回调可能是数组，若确定是函数的话就不要这层包装了
export function createFnInvoker(fns: Function | Array<Function>): Function {
    function invoker() {
        const fns = invoker.fns
        if (Array.isArray(fns)) {
            const cloned = fns.slice()
            for (let i = 0; i < cloned.length; i++) {
                cloned[i].apply(null, arguments)
            }
        } else {
            // return handler return value for single handlers
            return fns.apply(null, arguments)
        }
    }
    invoker.fns = fns
    return invoker
}
// 其实就是判断listeners和oldListeners然后对事件进行相应的注册和卸载
export function updateListeners(
    on: Object,
    oldOn: Object,
    add: Function,
    remove: Function,
    vm: Component
) {
    // def为cur副本，给weex框架处理参数使用
    let name, def, cur, old, event
    // 以listeners为视角遍历
    for (name in on) {
        // 存储新的事件对象，def为副本
        def = cur = on[name]
        old = oldOn[name]
        // 解析event修饰符情况
        event = normalizeEvent(name)
        /* istanbul ignore if */
        // weex框架处理，其添加事件可传params
        // 值得注意的是非weex是没有params的
        if (__WEEX__ && isPlainObject(def)) {
            cur = def.handler
            event.params = def.params
        }
        if (isUndef(cur)) {
            // 若是新的事件不存在就报警告
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            )
        } else if (isUndef(old)) {
            // 若是新的存在就得不存在那么就得添加新的事件了
            if (isUndef(cur.fns)) {
                // 包装一下事件回调
                // 这里关键在与on[name]赋值，是新事件的FnInvoker
                cur = on[name] = createFnInvoker(cur)
            }
            // 调用传入的add方法注册时间
            // 不同的框架传入的add自然也是不一样的
            add(event.name, cur, event.once, event.capture, event.passive, event.params)
        } else if (cur !== old) {
            // 若是新旧都存在，那么就改下事件的回调就行了
            // 就像点击事件，新的只是改了点击事件的回调而已，不需要重新绑定点击事件
            old.fns = cur
            // 这时候old是新的了，所以赋值给on，这样子on也是新的了
            on[name] = old
        }
    }
    // 遍历旧的事件列表
    for (name in oldOn) {
        // 若是这个事件在新的里面不存在说明是多余的需要去除
        if (isUndef(on[name])) {
            event = normalizeEvent(name)
            remove(event.name, oldOn[name], event.capture)
        }
    }
}
