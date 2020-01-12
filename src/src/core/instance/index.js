import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
// 以下混入一些实例方法vm.xxx
// 混入_init方法
initMixin(Vue)
// 设置数据代理、混入$watch、$set、$delete等状态数据相关实例方法
stateMixin(Vue)
// 混入$on、$emit等事件相关实例方法
eventsMixin(Vue)
// 混入$destroy、$forceUpdated等生命周期相关实例方法
lifecycleMixin(Vue)
// 混入_render、$nextTick、_s等一些渲染需要的一些方法
renderMixin(Vue)

export default Vue
