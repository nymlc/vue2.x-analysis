/* @flow */

import { dirRE, onRE } from './parser/index'

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
// /\bdo\b|\bif\b/
// 就是这些单词不能出现在模板表达式里
const prohibitedKeywordRE = new RegExp('\\b' + (
    'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
    'super,throw,while,yield,delete,export,import,return,switch,default,' +
    'extends,finally,continue,debugger,function,arguments'
).split(',').join('\\b|\\b') + '\\b')

// these unary operators should not be used as property/method names
const unaryOperatorsRE = new RegExp('\\b' + (
    'delete,typeof,void'
).split(',').join('\\s*\\([^\\)]*\\)|\\b') + '\\s*\\([^\\)]*\\)')
/**剥离字符串，留下表达式，就像
 * flag{{if}}flag   expression会是    "flag"+_s(if)+"flag"   
 * 剥离之后就是  +_s(if)+
 * 
1. 单引号包裹的字符串，字符串分俩种: 可适配：'\dflag'
    ①：非'非\
    ②：\.
    '(?:[^'\\]|\\.)*'|
2. 类似第一条，可适配："\dflag"
    "(?:[^"\\]|\\.)*"|
3. 类似第一条，只是右边加了${，可适配：`\dflag${
    `(?:[^`\\]|\\.)*\$\{|
4. 类似第一条，只是左边加了}，可适配：}\dflag`
    \}(?:[^`\\]|\\.)*`|
5. 类似第一条，可适配：`\dflag`
    `(?:[^`\\]|\\.)*`
 * 
*/
// strip strings in expressions
const stripStringRE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// detect problematic expressions in a template
export function detectErrors(ast: ?ASTNode): Array<string> {
    const errors: Array<string> = []
    if (ast) {
        checkNode(ast, errors)
    }
    return errors
}
/**
 *
{
    "type": 1, // 1是元素节点，2是文本节点，3是注释节点
    "tag": "div",  // 标签
    "attrsList": [{
        "name": "id",
        "value": "app"
    }], // 属性列表
    "attrsMap": {
        "id": "app"
    }, // 属性map
    "children": [{
        "type": 2,
        "expression": "_s(flag)", // 表达式字符串
        "tokens": [{
            "@binding": "flag"
        }],
        "text": "{{flag}}", // 文本字符串
        "static": false
    }], // 子节点
    "plain": false,
    "attrs": [{
        "name": "id",
        "value": "\"app\""
    }],
    "static": false,
    "staticRoot": false
}
 */
function checkNode(node: ASTNode, errors: Array<string>) {
    if (node.type === 1) {
        // 若是元素节点
        for (const name in node.attrsMap) {
            // /^v-|^@|^:/
            // 就是检查下name是否符合v-、@、:开头的，也就是是否是指令
            if (dirRE.test(name)) {
                // 获取到指令对应的值
                const value = node.attrsMap[name]
                if (value) {
                    if (name === 'v-for') {
                        // 若是v-for
                        checkFor(node, `v-for="${value}"`, errors)
                    } else if (onRE.test(name)) {
                        // /^@|^v-on:/ 若是事件绑定  @、v-on:
                        checkEvent(value, `${name}="${value}"`, errors)
                    } else {
                        // 其他属性
                        checkExpression(value, `${name}="${value}"`, errors)
                    }
                }
            }
        }
        // 若是有子节点就递归遍历
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                checkNode(node.children[i], errors)
            }
        }
    } else if (node.type === 2) {
        // 若是带插值的文本节点
        checkExpression(node.expression, node.text, errors)
    }
}
/**检查事件是否有问题
 * 
 * @param {*} exp delete('Delete')
 * @param {*} text @click="delete('Delete')"
 * @param {*} errors 
 */
function checkEvent(exp: string, text: string, errors: Array<string>) {
    // 剥离无关的字符串  得到   delete()
    const stipped = exp.replace(stripStringRE, '')
    // 匹配是否有一元操作符
    const keywordMatch: any = stipped.match(unaryOperatorsRE)
    // 若是存在一元操作符且其前一个字符非$就报错：避免在表达式里使用一元操作符
    if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
        errors.push(
            `avoid using JavaScript unary operator as property name: ` +
            `"${keywordMatch[0]}" in expression ${text.trim()}`
        )
    }
    checkExpression(exp, text, errors)
}
/**
 * 检测v-for表达式是否有问题   (val, name, index) in list  也就是val、name、index、list是不是符合表达式格式
 * @param {*} node { for: 'list', alias: 'val', iterator1: 'name', iterator1: 'index' }
 * @param {*} text v-for="(val, name, index) in list"
 * @param {*} errors 
 */
function checkFor(node: ASTElement, text: string, errors: Array<string>) {
    checkExpression(node.for || '', text, errors)
    checkIdentifier(node.alias, 'v-for alias', text, errors)
    checkIdentifier(node.iterator1, 'v-for iterator', text, errors)
    checkIdentifier(node.iterator2, 'v-for iterator', text, errors)
}
/**
 * 检查所给的字符串是否是合适的标识符
 * @param {*} ident val
 * @param {*} type v-for alias
 * @param {*} text v-for="(val, name, index) in list"
 * @param {*} errors 
 */
function checkIdentifier(
    ident: ?string,
    type: string,
    text: string,
    errors: Array<string>
) {
    // 首先所给的标识符得是字符串
    if (typeof ident === 'string') {
        try {
            // 作为变量是可以声明
            new Function(`var ${ident}=_`)
        } catch (e) {
            errors.push(`invalid ${type} "${ident}" in expression: ${text.trim()}`)
        }
    }
}
// 检查表达式是否有问题
// 1. 表达式本身错误
// 2. 表达式包含禁止使用的关键词，前提是上条，也就是具体下错误信息
function checkExpression(exp: string, text: string, errors: Array<string>) {
    // 就是将其转为函数然后看是否会异常
    try {
        // 作为插值是可以return
        new Function(`return ${exp}`)
    } catch (e) {
        const keywordMatch = exp.replace(stripStringRE, '').match(prohibitedKeywordRE)
        if (keywordMatch) {
            // 若是发现有禁止的关键词就将错误push到errors
            errors.push(
                `avoid using JavaScript keyword as property name: ` +
                `"${keywordMatch[0]}"\n  Raw expression: ${text.trim()}`
            )
        } else {
            // 若是无效的表达式也是不成的
            errors.push(
                `invalid expression: ${e.message} in\n\n` +
                `    ${exp}\n\n` +
                `  Raw expression: ${text.trim()}\n`
            )
        }
    }
}
