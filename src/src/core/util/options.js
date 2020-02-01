/* @flow */
/**ø
 * 1. el、propsData使用默认合并策略 defaultStrat
 * 2. data使用mergeDataOrFn，最终返回的是函数，执行这个函数返回的就是data的数据副本
 * 3. 生命周期钩子就是父子合并成数组，父子均触发
 * 4. directives、filters、 components资源给处理成父通过原型链取到，可以在任意的地方取到内置的
 * 5. watch的话就和生命周期一样合并成数组
 * 6. props、methods、inject、computed处理成子覆盖父
 * 7. provide和data类似
 */
import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
// 参见官网说明即可，自定义合并策略的选项
// 合并策略选项分别接收在父实例和子实例上定义的该选项的值作为第一个和第二个参数，Vue 实例上下文被作为第三个参数传入
// 没配置的话就是个空对象
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  // 开发环境下给el、postData添加合并策略

  strats.el = strats.propsData = function (parent, child, vm, key) {
    //ø 必须有Vue实例，也就是el、postData必须在new Vue或者其子类时使用
    // 因为子类Vue.extend（mergeOptions没有传入vm）创造出来的，所以子类参数不能包含这俩
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */

/**
 * 将from（parent）对象的属性混入到to（child）对象，然后返回to（其实就是父生子，父不变，子变）
 *
 * @param {Object} to 对应child
 * @param {?Object} from 对应parent
 * @returns {Object}
 */
function mergeData (to: Object, from: ?Object): Object {
  // 没有parent就是要child
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      // 如果parent有在to对象上么有的属性就设置给to
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      // 如果to值是纯对象且from值也是纯对象，这个属性俩个都有就递归
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
//ø 处理data的合并最终处，它的处理返回值都是函数
// 也就是虽然我们在根实例可以以对象形式传入data，但是最终还是会被转成function
// 好处就是data都是唯一的数据副本，组件之间不能互相影响
//ø 还有就是里面可能引用了props数据，直接返回对象的话，props还没初始化呢
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 非new创建实例过来的
    // in a Vue.extend merge, both should be functions
    //ø 这里有说选项是在调用 Vue.extend 函数时进行合并处理的话，此时父子 data 选项都应该是函数
  
    // child没有data的话就返回parent data  eg: Vue.extend({})
    // 若是Vue.extend({})，那么 mergeOptions(Vue.options, {})，也就是执行不到data的策略函数(Vue.options没有data)
    /**
     * 若是如此
    const Parent = Vue.extend({ data() { return { flag: true } } })
    const Child = Parent.extend({})
    // 若是Parent.extend({})，那么 mergeOptions(Parent.options, {})，这时候childVal不存在，parentVal存在
     */
    //ø childVal、parentVal必有一个有值，不然就执行不到这，那么下面俩还给另一个有值
    if (!childVal) {
      return parentVal
    }
    //ø 要是这俩返回了，因为是非new创建实例，所以只能是函数，所以initData里执行 data.call(vm, vm)，所以还是传入了vm 
    if (!parentVal) {
      return childVal
    }
    // 到这的话说明俩都有值，返回一个函数
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
/**
 * 
 * var helloData = {
        count: 0
    }
    var Parent = Vue.extend({
        data: function () {
            return helloData
        }
    })
    var Child = Parent.extend({
        data() {
            return {
                dd: 2
            }
        }
    })
    // 这里会走到执行mergedInstanceDataFn函数（initData），而此时parentVal就是Child.options.data，也就是Child下的那个函数
    window.ln = new Child({ data: { a: {} } })
 */
      //ø 这里又有点不一样，这里因为parentVal.call(vm, vm)这执行，传入vm，所以这里的this也就是这么来的
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    // new创建实例
    // this._init  (mergeOptions(Vue.options, options, vm))  =>  mergeOptions(parent, child, vm)  =>  strats.data(parent.data, child.data, vm)  =>  mergeDataOrFn(Vue.options.data, options.data, vm)
    //ø 首先这里值会被赋值给 mergeOptions 里的options，然后赋值给vm.$options
    return function mergedInstanceDataFn () {
      // instance merge
      // childVal、parentVal要是函数的话就用其求值
      //ø 这里.call(vm, vm)也是很关键的，就是{ data(vm) {  } }，这里的vm就是传入的vm，且其作用域也是vm
      // 我们知道这个initData时会先取vm.$options.data求值，也就是执行本函数

      //ø 若是根实例（new Vue，非继承Vue的子类），这里的childVal就是new Vue()传的 data
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      //ø 若是根实例，undefined
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        // 如果子data有值，那么就把父data合并到子data
        return mergeData(instanceData, defaultData)
      } else {
        // 没有子data就返回父data（有点像继承样子）
        return defaultData
      }
    }
  }
}
// data的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 没有vm，处理的是非new创建实例
  if (!vm) {
    // 若非new创建实例的data(childVal)不是函数就给个警告，返回parent data
    //ø 在子组件（子组件注册调用.extend）data必须是函数的原因在于此
    // 其实子组件data是函数那么每次返回都是新的数据对象，可以防止被干扰
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    // 是函数的话就
    return mergeDataOrFn(parentVal, childVal)
  }
  // 处理new xxx过来的情况
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
//ø 可见钩子可以以数组形式传入，特别是继承的话，那就是如下
/**
 * [
    created: function () {
      console.log('parentVal')
    },
    created: function () {
      console.log('childVal')
    }
  ]
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}
// 给各个生命周期钩子赋合并策略
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
// 合并资源的策略
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  //ø 这里采用原型，也就是最终会变成
  /*
  res = {
    CustomComponent
    // 原型
    __proto__: {
      KeepAlive,
      Transition,
      TransitionGroup
    }
  }*/
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    // 把childVal混入到res
    return extend(res, childVal)
  } else {
    return res
  }
}
// 'component', 'directive', 'filter'这三个称为资源，因为可以第三方提供，可以方便注入
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
// watch合并策略
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // firefox上Object.prototype.watch存在，所以得处理下，置空，默认没有提供watch
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  // 老套路，没提供的话就用父的
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    // 开发环境下判断下是不是对象
    assertObjectType(key, childVal, vm)
  }
  // 父的没有的话就返回提供的
  if (!parentVal) return childVal
  const ret = {}
  // 这里就是父子都有watch项
  extend(ret, parentVal)
  // 循环遍历child，看情况把父的也给混入到子里，最后结果是数组
/**
 * {
    watch: {
        txt: [
            function () {
                console.log('txt change')
            },
            function () {
                console.log('txt change')
            }
        ]
    }
}
 */
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
// props、methods、inject、computed合并策略
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 这几货都得是纯对象
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  // 没有用Object.create(null)就是子覆盖父，因为就像methods，不能触发了父的再触发子的
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
// 和data合并策略差不多
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 */
// 默认合并策略，策略简单，有子选项就用子选项，否则就父选项
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
// 检查是否是有效的组件名
function checkComponents (options: Object) {
  for (const key in options.components) {
    validateComponentName(key)
  }
}
// 检查组件名是否有效
export function validateComponentName (name: string) {
  // 只能字母开头后接字母数字或者下划线或者-
  if (!/^[a-zA-Z][\w-]*$/.test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'can only contain alphanumeric characters and the hyphen, ' +
      'and must start with a letter.'
    )
  }
  // 1. 不能是内置标签
  // 2. 不能是保留标签（isReservedTag在platforms/web/runtime/index.js被重写）
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
// 规范化props
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  // 若是数组定义写法
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      // 
      if (typeof val === 'string') {
        // 连字符转驼峰
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        // 数组形式的话就必须得传字符串
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    // 若是纯对象的话
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
// {
//     props: ['size', 'myMessage']
// } 
// {
//     props: {
//         height: Number,
//         age: {
//             type: Number
//         }
//     }
// }
  // 就是这三种写法都转成
// {
//   props: {
//       age: {
//           type: Number
//       }
//   }
// }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
// 规范化inject
/**三种写法，需要都转成第三种
1. { inject: ['data1', 'data2'] }
2. { inject: { d: data } }
3. { inject: { d: { from: 'data' } } }
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    // 第①种写法
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    // 第②、③种写法
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
// 规范化directives
/**都转成filter1
{
    directives: {
        filter1: {
            bind: function () {}
        },
        filter2: function () {}
    }
}
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}
// 检测这个value是不是纯对象
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */

/**
 *合并选项，传入的参数不会被修改，只是通过俩参数返回一个新选项
 *内部会通过规范化选项、根据不同的选项选用不同的策略合并
 *
 * @export
 * @param {Object} parent 被合并的数据，比如Vue.options
 * @param {Object} child 要合并的数据，比如new Vue()、Vue.extend、Vue.mixin传的参数选项
 * @param {Component} [vm] vue实例 只在new创建实例时传入，在Vue.extend、Vue.mixin时不传入。如此可使用vm区分是否new创建实例
 * @returns {Object} 返回合并完的数据
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  // 检查是否是有效的组件名
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }
  // 也就是child还可以是函数，通过Vue.extend创造出来的子类也是有options这个属性的
  if (typeof child === 'function') {
    // Vue或者它的子类都是挂载了options
    child = child.options
  }
  // 规范化选项
  // 就像props，我们有多种定义写法，所以在内部统一成一种，方便处理，所以需要规范化
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)
  const extendsFrom = child.extends
  if (extendsFrom) {
    // extends是对象或者函数，那么就是简单地混入到parent
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  if (child.mixins) {
    // mixins是数组，需要遍历
    // 会把传入的mixins按照相应的策略return回来，赋值给parent
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }
  const options = {}
  let key
  // 遍历parent，处理各个选项
  for (key in parent) {
    mergeField(key)
  }
  // 遍历parent，处理各个选项
  for (key in child) {
    if (!hasOwn(parent, key)) {
      // child独有的选项才处理
      mergeField(key)
    }
  }
  function mergeField (key) {
    // 就是根据key来选择对应的策略，没有的话就默认defaultStrat
    // 就像生产环境下，el、postData就没有
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
