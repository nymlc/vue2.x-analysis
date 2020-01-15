/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
// 混入init方法
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    // 添加实例属性_uid，这是实例的唯一标志
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 判断对象是否是Vue实例对象，可用于Vue观测数据时避免观测Vue实例对象
    vm._isVue = true
    // merge options
    // 判断是否是组件对象的，创建组件的时候会传入包含_isComponent属性，值为true的option
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
// 获取Vue或者其子类的options
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    //ø 若是子类的话，这里很绕，来个例子
    /**
      const Child = Vue.extend({
          template: '<p>1</p>'
      })
      Vue.mixin({
          template: '<p>2</p>'
      })
      Child.mixin({
          template: '<p>3</p>'
      })
      new Child({}).$mount('#app')
     */
    // 不算下面modifiedOptions这里的调用的话，这里的Ctor就是Child，Ctor.super就是Vue
    /*
     superOptions当然就是合并之后的
     {
        components: {},
        directives: {},
        filters: {},
        _base: function () {},
        template: "<p>2</p>"
    }
    */
    // cachedSuperOptions在extend.js我们可以找到Sub.superOptions = Super.options，也就是cachedSuperOptions就是Vue.options当时的值
    // 为什么是当时呢，这是因为Vue.extend之后Vue.mixin把Vue.options的引用指向别的地址
    /*
     恩，也就是cachedSuperOptions就是
     {
          components: {},
          directives: {},
          filters: {},
          _base: function () {}
      }
     */
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    //ø 俩个必然不一样的，其实不管内容如何，就是Vue.mixin({})，这俩值也不一样，因为Vue.options的引用变了（看Vue.mixin源码即可知）
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 既然不一样了自然是要修正
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
// 处理修改过的
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  // 承接resolveConstructorOptions里的栗子
  /**
   如今的（Child.mixin之后的）Child.options
  {
    components: {},
    directives: {},
    filters: {},
    _base: function () {},
    template: "<p>3</p>"
  }
  */
  const latest = Ctor.options
  // Vue.extend传的参数   { template: '<p>1</p>' }
  const extended = Ctor.extendOptions
  /**
  Vue.extend之后合并的options
  {
    components: {},
    directives: {},
    filters: {},
    _base: function () {},
    template: "<p>1</p>"
  }
  */
  const sealed = Ctor.sealedOptions
  // 遍历现在的options
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      // 要是Vue.extend里传的和现在的不一样那么就得修正
      if (!modified) modified = {}
      // 其实这里处理的是生命周期钩子重复问题
      // 首先latest已经是最新值，值是没啥问题，值是若是生命周期钩子的话可能有重复
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

/**
 *去重
 *
 * @param {*} latest 当前值
 * @param {*} extended 传入的参数值
 * @param {*} sealed extend之后的值
 * @returns
 */
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    // 因为是数组，那么一般都是生命周期钩子函数，去重就是保证不要重复触发
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      //ø ①extended有，就代表是.extend时传入的参数，是新增的
      //ø ②sealed没有，就代表这个是.extend之后mixin混入的，也是新增的
      // 就像这个Parent传入的fn4，是父类持有的，就不计入，之后统一contact
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
