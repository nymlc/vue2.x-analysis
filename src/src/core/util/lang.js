/* @flow */

/**
 * Check if a string starts with $ or _
 */
export function isReserved(str: string): boolean {
    const c = (str + "").charCodeAt(0);
    return c === 0x24 || c === 0x5f;
}

/**
 * Define a property.
 */
// 主要是配置是否可枚举
export function def(obj: Object, key: string, val: any, enumerable?: boolean) {
    Object.defineProperty(obj, key, {
        value: val,
        enumerable: !!enumerable,
        writable: true,
        configurable: true,
    });
}

/**
 * Parse simple path.
 */
const bailRE = /[^\w.$]/;
export function parsePath(path: string): any {
    // 不是字母、数字、下划线、点号和$符号就return
    // 就像obj+a，+不在此列，自然是无效的
    // obj.a之类合法的，均在此列，自然是有效的
    if (bailRE.test(path)) {
        return;
    }
    const segments = path.split(".");
    return function (obj) {
        for (let i = 0; i < segments.length; i++) {
            if (!obj) return;
            obj = obj[segments[i]];
        }
        return obj;
    };
}
