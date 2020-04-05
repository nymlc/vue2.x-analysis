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
    const dataProp = {}

    Object.defineProperty(dataProp, 'getterProp', {
        enumerable: true,
        get: () => {
            console.error('This should not be logged!')
            return 'some value'
        },
    })

    const myComponent = {
        name: 'my-component',
        data() {
            return {
                dataProp,
            }
        },
        render(h) {
            return null
        },
    }
    Vue.component('my-component', myComponent)

    new Vue({
        el: '#app',
        template: `<div>
            <p class="title">打开console</p>
            <my-component></my-component>
        </div>`
    })
}

var version = getQueryString('v') || '2.5.17';
var index = location.hash.substring(1) || 1;

if (version) {
    loadScript('https://cdn.bootcss.com/vue/' + version + '/vue.js', function () {
        window["example".concat(index)]();
    });
}