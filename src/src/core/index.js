import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'
// 初始化一些全局API
initGlobalAPI(Vue)
// 当前 Vue 实例是否运行于服务器
Object.defineProperty(Vue.prototype, '$isServer', {
    get: isServerRendering
})
// 服务器端渲染上下文(SSR context)
Object.defineProperty(Vue.prototype, '$ssrContext', {
    get() {
        /* istanbul ignore next */
        return this.$vnode && this.$vnode.ssrContext
    }
})

// expose FunctionalRenderContext for ssr runtime helper installation
// 定义了 FunctionalRenderContext 静态属性
// 之所以在 Vue 构造函数上暴露该属性，是为了在 ssr 中使用它
Object.defineProperty(Vue, 'FunctionalRenderContext', {
    value: FunctionalRenderContext
})
// rollup会替换'__VERSION__'为实际版本
Vue.version = '__VERSION__'

export default Vue
