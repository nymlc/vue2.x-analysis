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
    let vm = new Vue({
        el: '#app',
        components: {
            comp: {
                template: `<section></section>`
            }
        },
        template: `<div><comp/></div>`
    })
}

var version = getQueryString('v') || '../js/vue.js';
var index = location.hash.substring(1) || 1;

if (version) {
    loadScript(+version.charAt(0) ? 'https://cdn.bootcss.com/vue/' + version + '/vue.js' : version, function () {
        window["example".concat(index)]();
    })
}