import inject from "@rollup/plugin-inject";
import ts from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import externals from "rollup-plugin-node-externals";

export const config = [
  {
    input: "./src/index.ts",
    output: [{
      dir: "./dist/esm",
      format: "esm",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].mjs",
    }, {
      dir: "./dist/cjs",
      format: "cjs",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].cjs",
    }],
    external: ["@noble/curves/ed25519"],
    plugins: [externals(), ts()]
  },
  {
    input: "./src/index.ts",
    output: [{
      dir: "./dist/types",
      format: "esm",
      exports: "named",
      preserveModules: true,
      sourcemap: false,
      entryFileNames: "[name].d.ts",
    }],
    external: ["@noble/curves/ed25519"],
    plugins: [externals(), ts(), dts()]
  },
  {
    input: "./src/index.test.ts",
    output: [{
      dir: "./dist/test",
      format: "esm",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].mjs",
    }],
    external: ["@noble/curves/ed25519"],
    plugins: [externals({ devDeps: true }), ts(), inject({ crypto: "node:crypto" })],
  },
  {
    input: "./src/index.bench.ts",
    output: [{
      dir: "./dist/bench",
      format: "esm",
      exports: "named",
      preserveModules: true,
      sourcemap: true,
      entryFileNames: "[name].mjs",
    }],
    external: ["@noble/curves/ed25519"],
    plugins: [externals({ devDeps: true }), ts()],
  },
]

export default config