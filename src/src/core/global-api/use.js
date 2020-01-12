/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  // 安装Vue插件用的
  Vue.use = function (plugin: Function | Object) {
    // 这里this指向Vue，所以_installedPlugins挂载在Vue上，可以用于判断是否重复安装插件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 取plugin之外的参数
    const args = toArray(arguments, 1)
    // 往前插入Vue
    args.unshift(this)
    // 执行plugin
    // 如果插件是一个对象，必须提供 install 方法
    // 如果插件是一个函数，它会被作为 install 方法。install 方法调用时，会将 Vue 作为参数传入
    // 区别就是后者插件里的this得按默认的来，要么是全局对象，要么是空（严格模式）
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
