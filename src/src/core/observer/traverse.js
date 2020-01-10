/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  // 完了之后清空seenObjects，以备下次使用
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 因为深度观测，所以不能是非对象、不能被冻结、不能是VNode实例
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // 这里是处理循环引用情况
  // 实现val是对象且响应式，那么必然有__ob__属性
  if (val.__ob__) {
    // 我们需要一个标志来定位到这个val，就用其对应的dep的id即可
    const depId = val.__ob__.dep.id
    // 判定seenObjects里已经添加了这个，也就是已经处理过了，就return
    if (seen.has(depId)) {
      return
    }
    // 没处理的就添加上标志已经处理了
    seen.add(depId)
  }
  // 因为数组可对象取值方法不一样，所以区分下，仅此而已。
  // 目的都是val[i]、val[keys[i]]这俩触发getter尔
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
