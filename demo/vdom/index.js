"use strict";

var loadScript = function loadScript(url, callback) {
    var script = document.createElement('script');

    script.onload = function () {
        return callback();
    };

    script.src = url;
    document.body.appendChild(script);
};
/**
 * 获取url链接带的参数
 * @param  {string} name 参数名
 */


function getQueryString(name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return r[2];
    return null;
}

function example1() {
    const lifecycles = ['beforeCreate', 'created', 'beforeMount', 'mounted', 'beforeUpdate', 'updated', 'activated', 'deactivated', 'beforeDestroy', 'destroyed']
    function createComponent(tag) {
        const comp = {
            template: `<div>comp-${tag}</div>`
        }
        lifecycles.forEach(itm => {
            comp[itm] = function () {
                console.error(`comp-${tag}  ${itm}`)
            }
        })
        return comp
    }
    window.ln = new Vue({
        el: '#app',
        components: {
            compa: createComponent('a'),
            compb: createComponent('b')
        },
        data: {
            type: true
        },
        mounted() {
            setTimeout(() => {
                this.type = false
            }, 4000)
        },
        template: `<div>
            <component v-if="type" is="compa" />
            <component v-else is="compb" />
        </div>`
    })
}

function example2() {
    loadScript('https://unpkg.com/vue-virtual-scroll-list@1.2.2/index.js', function () {
        Vue.component('VirtualList', VirtualScrollList);
        new Vue({
            template: `<div>
            <virtual-list :size="50" :remain="10" :klass="'list'">
                <item v-for="(udf, index) of items" :index="index" :key="index" />
            </virtual-list>
        </div>`,
            el: '#app',
            components: {
                item: {
                    props: ['index'],
                    template: `<div style="height:50px;border-bottom: 1px solid #eee;">
                        index: {{index}}
                    </div>`
                }
            },
            data: function () {
                return {
                    items: new Array(100000)
                }
            }
        })
    })
}
function example3() {
    window.ln = new Vue({
        el: '#app',
        template: `
          <div>
            <test class="test"></test>
          </div>
        `,
        components: {
            test: {
                data() {
                    return { ok: true }
                },
                template: '<div v-if="ok" id="ok" class="inner">test</div>'
            }
        }
    })

}

var version = getQueryString('v') || '../js/vue.js';
var index = getQueryString('e') || 1;

if (version) {
    loadScript(+version.charAt(0) ? 'https://cdn.bootcss.com/vue/' + version + '/vue.js' : version, function () {
        window["example" + index]();
    })
}