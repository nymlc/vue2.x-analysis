/* @flow */

import type Watcher from "./watcher";
import { remove } from "../util/index";
// 每个dep的id
let uid = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// 这个其实是消息中心，但是它只能服务于一个属性（defineReactive）、一个对象（Observer）
export default class Dep {
    static target: ?Watcher;
    id: number;
    subs: Array<Watcher>;

    constructor() {
        this.id = uid++;
        // 存储订阅此消息的所有订阅者，方便通知更新的时候遍历派发更新
        this.subs = [];
    }

    addSub(sub: Watcher) {
        this.subs.push(sub);
    }

    removeSub(sub: Watcher) {
        remove(this.subs, sub);
    }

    depend() {
        if (Dep.target) {
            Dep.target.addDep(this);
        }
    }

    notify() {
        // stabilize the subscriber list first
        const subs = this.subs.slice();
        for (let i = 0, l = subs.length; i < l; i++) {
            subs[i].update();
        }
    }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// 当前处理的watcher
Dep.target = null;
// 当前处理的watcher只能有一个，所以要是还没处理完当前的又设置Dep.target就得把后来的入栈
const targetStack = [];

export function pushTarget(_target: ?Watcher) {
    if (Dep.target) targetStack.push(Dep.target);
    Dep.target = _target;
}
// 完了之后出栈就能拿到后来的
export function popTarget() {
    Dep.target = targetStack.pop();
}
