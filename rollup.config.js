import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import ts from "@rollup/plugin-typescript";
import typescript from "ttypescript";

export const config = [
  {
    input: "./src/index.ts",
    output: [{
      dir: "./dist/types",
      format: "esm",
      exports: "named",
      preserveModules: true,
      entryFileNames: "[name].d.ts",
    }, {
      dir: "./dist/cjs",
      format: "cjs",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].cjs",
    }],
    plugins: [resolve(), ts({ typescript }), commonjs()],
    external: ["tslib", "@hazae41/binary", "@hazae41/berith", "@hazae41/paimon", "@hazae41/zepar", "@hazae41/morax", "@hazae41/foras", "@hazae41/x509", "@hazae41/asn1"]
  },
  {
    input: "./src/index.test.ts",
    output: [{
      dir: "./dist/test",
      format: "cjs",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].cjs",
    }],
    plugins: [resolve(), ts({ typescript }), commonjs()],
    external: ["tslib", "@hazae41/binary", "@hazae41/berith", "@hazae41/paimon", "@hazae41/zepar", "@hazae41/morax", "@hazae41/foras", "@hazae41/x509", "@hazae41/asn1", "uvu"]
  },
]

export default config