export * from './runtime-dom/index'

import { baseCompile } from './compile-core/src/index'
import * as runtimeDom from './runtime-dom/index'
import { registerRunTimeCompiler } from './runtime-dom/index'

function compileToFunction (template) {
  // code是函数的字符串
  const { code } = baseCompile(template)
  const render = new Function("Vue", code)(runtimeDom)
  return render
}

// registerRunTimeCompiler该函数的作用域中有全局变量，注入变量
registerRunTimeCompiler(compileToFunction)