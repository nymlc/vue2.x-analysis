/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    // 这个dep为对象或者数组服务
    // 在添加新属性的时候因为没有被转成响应式，那么已经注册的监听的依赖就不能被收集到属性对应的dep
    // 所以需要添加到这个属性所在的对象的dep，即此dep，也就是childOb.dep.depend()
    this.dep = new Dep()
    this.vmCount = 0
    // def __ob__属性到Observer实例对象上，用于复用
    // def的话防止在比如observeArray里__ob__被遍历到observe
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      // 这里是把Array.__proto__做了下处理，用于数组push等操作时的响应式
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      // 简单的遍历observe
      this.observeArray(value)
    } else {
      // 简单遍历defineProperty
      // 和数组遍历的处理不一样，这个是属性，所以defineProperty，数组的话每项均当做独立对象处理
      // 俩者区别在于dep一个为属性服务一个为对象服务
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 若是该值上有__ob__属性，且是Observer实例，那么说明该值已经是观察过了
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) { // 若是没有observe过且不是服务端渲染，值是数组或者对象且可扩展还不是Vue实例
    // 服务器渲染禁用了响应式数据，因为实际渲染需要确定性也就在服务器上预取了数据，这就意味着我们渲染时程序已经解析完成了状态，响应式也就多余了
    // Vue实例也禁用响应式，它的属性能改的（例如data）已经observe过了
    ob = new Observer(value)
  }
  // 若是RootData（即data本身），那么就会计数
  // eg：一个Hello组件(data引用的同一个对象)，每用一次组件vmCount就会++
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 一个属性一个dep
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 缓存getter和setter
  const getter = property && property.get
  const setter = property && property.set
  /**
   * 1. 若是arguments.length === 3，也就是传入了val，自然不用取值
   * 2. 若是setter在的话，那么也得被观测，因为要是没被观测，那么defineProperty后重新定义了get、set，重新赋值的话新的值也会被观测（set里逻辑），这就前后违背了
   * 3. 若是getter在setter不在的话，则getter只是返回某个值，不需要观测，观测的话就会触发原本未知的getter，引发问题
   */
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 因为val可能是对象，所以需要深度观测，返回的是子观测实例
  /**
   * const data = {
        a: {
            b: 1
        }
    }
    观测data，那么data闭包引用的childOb是data.__ob__，data.a的childOb是data.a.__ob__
    因为observe(new Observer(data)) => Observer(def(data, __ob__))
   */
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 通过之前缓存的getter求值，没有getter的话就返回val
      const value = getter ? getter.call(obj) : val
      // 若是Dep.target（Watcher）存在，那么需要收集依赖通过当前属性的dep
      if (Dep.target) {
        dep.depend()
        // 要是childOb存在的话，就把依赖放进这个对象dep里
        /**
          a: {
              b: 1,
              __ob__
          }
          this.$watch(this.a, 'c', () => {})
        */
        // 这里很关键，就比如这个$watch，依赖于a.c，但是c的dep不在（还没有响应式），那么就只能把它放进a的dep里
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 添加新属性使用，用到了对象对应的dep
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 若是数组的话那么直接使用splice，因为这个Array.splice已经被拦截了
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 处理数组长度，因为可能添加的位置大于数组长度
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  // 如果已经存在了这个key，那么就是响应式，直接设置即可
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  // 到这里就是新增属性
  // 首先不能是Vue实例，可能出现覆盖情况
  // 其次不能是根data，根data的dep是在state.js initData方法里的observe生成的，就没有机会收集依赖
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 不存在ob的话那么就是这个target就不是响应式的，设置值就行了
  if (!ob) {
    target[key] = val
    return val
  }
  /**
   * a: {
        b: 1,
        __ob__
    }
   */
  // 比如给a设置一个新属性c，那么ob.value其实就是a对象
  // 因为这个__ob__是new Observer(a)生成的，也就是value就是a
  // 所以给a的c属性设置成响应式
  defineReactive(ob.value, key, val)
  // 也就是a.__ob__.notify()，派发更新a对象收集到的订阅，也就会访问a.c，自然而然的把依赖重新添加到c属性对应的闭包dep里
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  // 防止传入非对象参数
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 要是数组的话，那么直接调用splice即可，因为这个被拦截处理过了
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 若是要删粗的属性不存在就直接return
  if (!hasOwn(target, key)) {
    return
  }
  // 删除掉这个属性
  delete target[key]
  // 若不是响应式，就直接返回无需通知
  if (!ob) {
    return
  }
  // 否则得通知
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 把数组每一项所对应的dep收集下依赖
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
