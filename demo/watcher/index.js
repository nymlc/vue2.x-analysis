const bailRE = /[^\w.$]/

function parsePath(path) {
    if (bailRE.test(path)) {
        return
    }
    const segments = path.split('.')
    return function (obj) {
        for (let i = 0; i < segments.length; i++) {
            if (!obj) return
            obj = obj[segments[i]]
        }
        return obj
    }
}

function Observer(obj, key, value) {
    var dep = new Dep()
    if (Object.prototype.toString.call(value) == '[object Object]') {
        Object.keys(value).forEach(function (key) {
            new Observer(value, key, value[key])
        })
    }

    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function () {
            if (Dep.target) {
                dep.addSub(Dep.target)
            }
            return value
        },
        set: function (newVal) {
            value = newVal
            dep.notify()
        }
    })
}

class Watcher {
    constructor(vm, expOrFn, cb) {
        this.vm = vm
        this.cb = cb
        if (typeof expOrFn === 'function') {
            this.getter = expOrFn
        } else {
            this.getter = parsePath(expOrFn)
        }
        Dep.target = this
        this.value = this.get()
        Dep.target = null
    }
    get() {
        let value = this.getter.call(this.vm, this.vm)
        return value
    }
    update() {
        let value = this.get()
        let oldValue = this.value
        this.value = value
        this.cb.call(this.vm, value, oldValue)
    }
}
class Dep {
    constructor() {
        this.subs = []
    }
    addSub(watcher) {
        this.subs.push(watcher)
    }
    notify() {
        this.subs.forEach(function (watcher) {
            watcher.update()
        })
    }
}
var obj = {
    a: 1,
    b: 2,
    c: 3
}
Object.keys(obj).forEach(function (key) {
    new Observer(obj, key, obj[key])
})

initText(obj.a, obj.a)
new Watcher(obj, 'a', function (nVal, oVal) {
    console.log(`nVal: ${nVal} -- oVal: ${oVal}`)
    initText(nVal, oVal)
})

function initText(nVal, oVal) {
    const $txt = document.getElementById('txt')
    $txt.innerHTML = `nVal: ${nVal} -- oVal: ${oVal}`
}

document.getElementsByTagName('button')[0].addEventListener('click', function () {
    obj.a = Math.round(Math.random() * 1000) + 1
}, false)