import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import ts from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import typescript from "ttypescript";

export const config = [
  {
    input: "./src/index.ts",
    output: [{
      dir: "./dist/cjs",
      format: "cjs",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].cjs",
    }],
    plugins: [resolve(), ts({ typescript }), commonjs()],
    external: ["tslib", "@peculiar/x509", "@hazae41/berith", "@hazae41/paimon", "@hazae41/zepar", "@hazae41/morax"]
  },
  {
    input: "./src/index.ts",
    output: [{
      dir: "./dist/types",
      format: "esm",
      exports: "named",
      preserveModules: true,
      entryFileNames: "[name].d.ts",
    }],
    plugins: [dts(), resolve(), ts({ typescript })],
    external: ["tslib", "@peculiar/x509", "@hazae41/berith", "@hazae41/paimon", "@hazae41/zepar", "@hazae41/morax"]
  }
]

export default config