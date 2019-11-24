/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
let pending = false

function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc
let macroTimerFunc
/**
 * 默认使用microtask。
 * HTML标准规定，task之后UI会渲染，那么在当前tick的microtask更新数据就显得很合适，这样子下一个tick开始之前，UI更新
 * 要是使用macrotask的话，那么渲染俩次
 * 
 */
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
/**
 * macroTimerFunc就三个选择，依次降级setImmediate、MessageChannel、setTimeout
 * 
 */
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
/**
 * 若是原生支持Promise，那么则采用Promise否则走macroTimerFunc
 */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    /**
     * 在有问题的UIWebViews中，Promise.then不会完全中断，不过它可能会陷入一种奇怪的状态
     * 也就是回调被加入到microtask，但是直到浏览器需要做一些其他的事（比如处理一个timer）之前队列没被执行
     * 因此我们可以通过加入一个空timer去强制这个microtask队列刷新
     */
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
/**
 * 这个就是用于解决microtask优先级太高引起的问题
 * 其实就是一层包裹，赋值useMacroTask为true，然后执行回调，完了置回
 * 有个小点就是._withTask，这样子不用每次重新赋值
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    const res = fn.apply(null, arguments)
    useMacroTask = false
    return res
  })
}
/**
 *
 *
 * @export
 * @param {Function} [cb]
 * @param {Object} [ctx] 上下文
 * 值得注意的是: 
 * 1. 若是调用为this.$nextTick，那么ctx就是this（src/src/core/instance/render.js）
 * 2. 若是Vue.nextTick就必须传入ctx，不然会是undefined，或者global object
 * Vue.prototype.$nextTick = function (fn: Function) {
       return nextTick(fn, this)
   }
   Vue.nextTick = nextTick
 * 
 */
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    /**
     * 若是有传入cb，那么就执行
     * 因为cb传入的不确定性，所以得trycatch包裹
     */
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  // 保证一个tick内执行一次
  /*  如栗子所示，一个tick之内可能会有很多个调用
      第一个tick进来pending为false，其它的都是true
      首次进来触发macroTimerFunc/microTimerFunc，因为异步，所以其它的tick都会先添加完毕
      然后真正执行macroTimerFunc/microTimerFunc里挂载的flushCallbacks
  */
  if (!pending) {
    pending = true
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  // $flow-disable-line
  /**
   * 这里有点巧妙，要是没有传入回调函数且支持Promise
   * 那么返回一个Promise对象，里面的resolve赋值给_resolve
   * 而_resolve执行时间点在flushCallbacks，也就是对应的then方法也就被触发执行了
   */
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
