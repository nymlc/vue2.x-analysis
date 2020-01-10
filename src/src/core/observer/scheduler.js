/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100
// 这个队列就是把需要派发更新的订阅者收集起来放在下一个tick一起更新
const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
// 这个就是用来判断当前队列有哪些watcher通过id
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
// 这个用于判断本次队列是否收集完，true的话也就是收集的订阅循环派发完了
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
// 重置scheduler状态
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  // 若是开发环境，那么就每轮更新执行之后置空这个无限循环检测标志
  // 这是因为下面检测也是开发环境下检测的
  // 也就是默认生存环境下不会出现这种糟糕的代码
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  // 1. 组件更新是父到子的，所以需要父在前
  // 2. user watch在渲染watch之前
  // 3. 若是一个组件在父组件的watcher执行期间被销毁，那么子组件的watcher自然也得跳过
  // 从小到大排序
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 这里没有缓存queue.length是因为这个queue还没遍历完可能就改变了
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    // 这个就是执行before函数，就是beforeUpdated钩子
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    // 置空，保证下一次派发订阅者可以入队列，在这里是因为执行更新过程中订阅者也可能入队列
    has[id] = null
    // 就是执行watcher里提供的run接口
    watcher.run()
    // in dev build, check and stop circular updates.
    // watcher.run()可能导致has[id]又有值，就会无限循环
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      // 这个计算id这个watcher执行了几次在一次执行更新过程里，超过100的话说明程序有问题，可能无限循环
      // 防止奔溃就break
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 在重置数据之前浅拷贝下数据
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
  // 重置数据
  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  // 执行updated钩子
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}
// 执行updated钩子
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    // 要是当前这个watcher是渲染watcher，而且已经挂载了，那么触发updated钩子
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // 若是这个watcher还没有入队列防止相同的订阅者入队列
  // （但是只能在本轮派发更新防止，此轮更新还未完毕，下一轮派发就开始了，这时候has置空就会有可能一样的id的watcher入队列）
  if (has[id] == null) {
    has[id] = true
    // 订阅循环派发未完就入队列
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      // 这个就是有可能在还没有执行更新完毕就又有订阅者入队列这个就得判断入得位置
      // 假设已经有俩[{id: 1}, {id: 2}]，假设已经循环到{id: 1}这个watcher，那么这时候index还是0，我们要插入的位置也是{id: 1}后面
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // waiting保证一次派发过程只执行一次flushSchedulerQueue
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
