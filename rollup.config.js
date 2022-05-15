import typescript from "@rollup/plugin-typescript"
import pkg from "./package.json"

export default {
  input: "./src/index.ts",
  output: [
    // 根据commonjs和esm规范打包两次
    {
      format: "cjs",
      file: pkg.main
    },
    {
      format: "es",
      file: pkg.module
    }
  ],
  plugins: [
    typescript()
  ]
}