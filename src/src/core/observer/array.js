/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    // 通过原有的方法获取到结果
    const result = original.apply(this, args)
    // 拿到Observer对象实例，通过这个可以取到dep，也就可以通知变化
    const ob = this.__ob__
    // push、unshift、splice都有添加新元素，所以需要取到新元素，然后观测
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 观测新增的数据
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 通知该对象收集的订阅者需要更新了
    ob.dep.notify()
    return result
  })
})
