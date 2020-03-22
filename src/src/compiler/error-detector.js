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
            if (dirRE.test(name)) {
                const value = node.attrsMap[name]
                if (value) {
                    if (name === 'v-for') {
                        checkFor(node, `v-for="${value}"`, errors)
                    } else if (onRE.test(name)) {
                        checkEvent(value, `${name}="${value}"`, errors)
                    } else {
                        checkExpression(value, `${name}="${value}"`, errors)
                    }
                }
            }
        }
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

function checkEvent(exp: string, text: string, errors: Array<string>) {
    const stipped = exp.replace(stripStringRE, '')
    const keywordMatch: any = stipped.match(unaryOperatorsRE)
    if (keywordMatch && stipped.charAt(keywordMatch.index - 1) !== '$') {
        errors.push(
            `avoid using JavaScript unary operator as property name: ` +
            `"${keywordMatch[0]}" in expression ${text.trim()}`
        )
    }
    checkExpression(exp, text, errors)
}

function checkFor(node: ASTElement, text: string, errors: Array<string>) {
    checkExpression(node.for || '', text, errors)
    checkIdentifier(node.alias, 'v-for alias', text, errors)
    checkIdentifier(node.iterator1, 'v-for iterator', text, errors)
    checkIdentifier(node.iterator2, 'v-for iterator', text, errors)
}

function checkIdentifier(
    ident: ?string,
    type: string,
    text: string,
    errors: Array<string>
) {
    if (typeof ident === 'string') {
        try {
            new Function(`var ${ident}=_`)
        } catch (e) {
            errors.push(`invalid ${type} "${ident}" in expression: ${text.trim()}`)
        }
    }
}
// 检查表达式是否有问题
function checkExpression(exp: string, text: string, errors: Array<string>) {
    // 就是将其转为函数然后看是否会异常
    try {
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
