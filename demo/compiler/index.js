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
    Vue.component('hello', {
        data: function (_data) {
            function data() {
                return _data.apply(this, arguments);
            }

            data.toString = function () {
                return _data.toString();
            };

            return data;
        }(function () {
            return data;
        }),
        computed: {
            vmCount: function vmCount() {
                return this.$data.__ob__.vmCount;
            }
        },
        template: "<div>\n                    hello{{vmCount}}\n                    </div>"
    });
    new Vue({
        data: {
            flag: 1
        },
        methods: {
            change: function change() {
                this.flag = !this.flag;
            }
        },
        template: '<div @click="change">' +
            '<p class="title">编译器多次编译</p>' +
            '<div v-if="flag">' +
            '{{flag}}' +
            '</div>' +
            '<div v-else>' +
            '<hello />' +
            '</div>' +
            '</div>'
    }).$mount('#app');
}

function example2() {
    window.ln = new Vue({
        data: {
            width: 50
        },
        mounted: function mounted() {
            var $progress = document.getElementById('val');
            console.error($progress.getAttribute('value'));
            console.error($progress.value);
        },
        template: '<div><progress id="val" v-bind:value="width" max="100.0">{{width}}</progress>{{width}}</div>'
    }).$mount('#app');
}

var version = getQueryString('v') || '2.5.17';
var index = location.hash.substring(1) || 1;

if (version) {
    loadScript('https://cdn.bootcss.com/vue/' + version + '/vue.js', function () {
        window["example".concat(index)]();
    });
}