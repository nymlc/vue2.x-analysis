/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  // 常规套路，防止被修改
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 设置全局配置
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 公共方法，不过看注释说有可能有问题，主要是因为这个玩意可能会变动不稳定
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }
  // 同样的方法，全局的设置
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 就这玩意
/**
 Vue.options = {
    components: {},
    directives: {},
    filters: {}
}
 */
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })
  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 这个就是用于取构造函数的
  Vue.options._base = Vue
  // extend KeepAlive到components，因为这货是内置的
  extend(Vue.options.components, builtInComponents)
  // 挂载use相关的方法
  initUse(Vue)
  // 挂载mixin静态方法
  initMixin(Vue)
  // 挂载extend静态方法
  initExtend(Vue)
  // 挂载资源注册静态方法（Vue.component、Vue.directive、Vue.filter）
  initAssetRegisters(Vue)
}
