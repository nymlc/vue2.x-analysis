/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean; // 用于判断是否是用户设置的watcher
  computed: boolean;
  sync: boolean;
  dirty: boolean; // 这个是给computed使用的，false意为已经计算了
  active: boolean;
  dep: Dep;
  deps: Array<Dep>;     // 当前的watcher被哪些dep收集了以及它们的id
                        // deps、depIds是当前的   newDeps、newDepIds是页面重新渲染之后的情况（初始时为空，cleanupDeps导致的），也就是重新收集
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    // 若是渲染watcher，则赋值在_watcher上
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.computed = !!options.computed
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.computed = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.computed // for computed watchers
    // 当前的watcher被哪些dep收集了以及它们的id
    // deps、depIds是当前的   newDeps、newDepIds是页面重新渲染之后的情况（初始时为空，cleanupDeps导致的），也就是重新收集
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    // 传入的取值表达式，用于报错提示
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    // 将expression转成getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 将'a.b.c'转成取值函数
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    if (this.computed) {
      this.value = undefined
      this.dep = new Dep()
    } else {
      this.value = this.get()
    }
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 设置Dep.target
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 触发getter用于收集依赖
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        // 用户设置的话那么就会报错具体的语句
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 若是deep观测，那么久递归读取子属性值，已达到收集子属性依赖
        traverse(value)
      }
      // 当前watcher完了之后就得置空(pop)，轮到新的watcher
      popTarget()
      // 清理下订阅，比如之前订阅了a、b，现在订阅了a、c，那么得把b给清掉就这么个性能优化
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      // 本轮收集中还没订阅这个dep
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        // 还没有订阅这个需要订阅的dep
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    // 循环遍历当前订阅过的deps
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        // 若是新的不订阅这个曾经订阅过得dep就得删除
        // 这样子完成了dep的取消订阅
        dep.removeSub(this)
      }
    }
    // 就是更新下当前的订阅列表
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp // 这里得需要，不然this.depIds也会被clear，下同
    this.newDepIds.clear()

    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.computed) {
      // A computed property watcher has two modes: lazy and activated.
      // It initializes as lazy by default, and only becomes activated when
      // it is depended on by at least one subscriber, which is typically
      // another computed property or a component's render function.
      if (this.dep.subs.length === 0) {
        // In lazy mode, we don't want to perform computations until necessary,
        // so we simply mark the watcher as dirty. The actual computation is
        // performed just-in-time in this.evaluate() when the computed property
        // is accessed.
        this.dirty = true
      } else {
        // In activated mode, we want to proactively perform the computation
        // but only notify our subscribers when the value has indeed changed.
        this.getAndInvoke(() => {
          this.dep.notify()
        })
      }
    } else if (this.sync) {
      this.run()
    } else {
      // 这里是个优化
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // 这个才是真正更新变化操作的地方，也是Scheduler调用的接口
  run () {
    // 判断激活的话才更新
    if (this.active) {
      this.getAndInvoke(this.cb)
    }
  }
  // 获取新的值以及执行回调
  getAndInvoke (cb: Function) {
    const value = this.get()
    // 判断新旧值是否一致
    // 关键还在于是否是对象，因为对象引用一样但是值可能不一样
    // 深度监听也是
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      isObject(value) ||
      this.deep
    ) {
      // set new value
      const oldValue = this.value
      // 设置新的值到value
      this.value = value
      // 计算属性是惰性求值，代表已经求过值了
      this.dirty = false
      // 用户watch的话
      if (this.user) {
        // 回调不可知，可能会报错，所以try/catch
        try {
          // $watch回调里的两新旧参数值这里来的
          cb.call(this.vm, value, oldValue)
        } catch (e) {
          handleError(e, this.vm, `callback for watcher "${this.expression}"`)
        }
      } else {
        cb.call(this.vm, value, oldValue)
      }
    }
  }

  /**
   * Evaluate and return the value of the watcher.
   * This only gets called for computed property watchers.
   */
  evaluate () {
    if (this.dirty) {
      this.value = this.get()
      this.dirty = false
    }
    return this.value
  }

  /**
   * Depend on this watcher. Only for computed property watchers.
   */
  depend () {
    if (this.dep && Dep.target) {
      this.dep.depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    // 是否激活，默认激活，取消监听就置为false
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        // 若是组件没被销毁，那么得将当前观察者remove
        // _watchers这个在initState时初始化到当前实例
        // 实例化Watcher时会push到这个数组，也就是存着当前实例所有的watcher
        // 这个用于在销毁组件实例时循环调用teardown方法来取消监听
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      // 循环遍历收集了此watcher的dep，将此watcher从订阅者列表移除
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
