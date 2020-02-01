/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy
// 非生产环境才会export出initProxy
if (process.env.NODE_ENV !== 'production') {
  // 这是全局函数或者变量合集，allowedGlobals将会是个函数，用于检测传入的参数是否是全局方法或变量
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )
  // 一个警告方法，提示target未定义
  // 比如模板里引用了txt，data却没有定义txt就会报此错误
  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }
// 判断是否支持原生Proxy
  const hasProxy =
    typeof Proxy !== 'undefined' && isNative(Proxy)

  if (hasProxy) {
    // 判断是否是内置修饰符
    //ø 其实@click.stop，事件注册的修饰符校验
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    //ø 其实是防止Vue.config.keyCodes.xxx被修改
    // 这里给Vue.config.keyCodes设置了一层代理
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
        // 判断要修改的key是否是内置修饰符
        if (isBuiltInModifier(key)) {
          // 是的话报错
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          // 否则就正常设置属性
          target[key] = value
          return true
        }
      }
    })
  }

  const hasHandler = {
    has (target, key) {
      // 简单属性查询
      const has = key in target
      // 1. 查询这个属性是不是全局方法或者变量   对应Number、undefined等
      // 2. 看看这个属性是不是_开头的字符串   对应_c、_v等render工具方法。其实这里要是有_txto之类的非render工具方法又没有定义的也会被允许
      //ø 这俩个均允许
      const isAllowed = allowedGlobals(key) || (typeof key === 'string' && key.charAt(0) === '_')
      // 要是没有查询到属性，那么也可能是被允许的
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }
      //ø 这里很关键，若是能查询到这个属性那么就返回true，这样子代表这个属性在target上，可通过in查询
      // 若不是在target的话，就得看isAllowed。若isAllowed是true，那么就得返回false
      // 我们分四种情况
      // 1. 有定义，has为true                                           整体为true    不报错
      // 2. 未定义，has为false，key为全局方法或者变量，isAllowed为true   整体为false   不报错
      // 3. 未定义，has为false，key为_xxx，isAllowed为true              整体为false   报错被try/catch捕获
      // 4. 未定义，has为false，key为xxx，isAllowed为false              整体为true   不报错不能被try/catch捕获
      //ø has返回true说明在target上，就会从target上找这个key
      // 返回false说明不在，那么就会从global找这个key

      // 如下，虽然没有_txt，但是window上有，那么就可以正常运行。Number同理
      /**
        <div id="app">
            <div>
                {{ _txt }}
            </div>
        </div>
       
        window._txt = 100
        new Vue({
            data: {
                txt: 1
            }
        }).$mount('#app') 
       */

      return has || !isAllowed
    }
  }

  const getHandler = {
    get (target, key) {
      // 简单判定下没有这个属性就报错
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  initProxy = function initProxy (vm) {
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      //ø 在使用webpack配合vue-loader的环境中，vue-loader会借助[vuejs@component-compiler-utils](https://github.com/vuejs/component-compiler-utils/blob/master/lib/compileTemplate.ts)
      // 我们可以发现它把template编译成不使用with，遵循严格模式。还给render方法设置_withStripped属性，值为true
      // 不使用with的render访问属性使用vm.xx，这样子proxy has就不适用了，得换成get
      // 使用with的话就得换成has

      // 对于_withStripped，若是自己编写的render方法，引用了不存在的属性，那么需要手动设置这个_withStripped属性，不然没有提示
      const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
