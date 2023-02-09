import { Bitset } from "@hazae41/bitset"
import { benchSync } from "@hazae41/deimos"
import { relative, resolve } from "path"

const samples = 100_000

const packed = 255

const directory = resolve("./dist/bench/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))

const resArith = benchSync("arithmetic", () => {
  const bitset = new Bitset(packed, 8)
  const a = Boolean(bitset.getBE(0))
  const b = Boolean(bitset.getBE(1))
  const c = bitset.last(6).value

  console.assert(a === true)
  console.assert(b === true)
  console.assert(c === 63)
}, { samples })

const resString = benchSync("string", () => {
  const bitset = packed.toString(2)
  const a = Boolean(bitset[0])
  const b = Boolean(bitset[1])
  const c = parseInt(bitset.slice(2, 8), 2)

  console.assert(a === true)
  console.assert(b === true)
  console.assert(c === 63)
}, { samples })

resString.tableAndSummary(resArith)