import { benchSync } from "@hazae41/deimos"
import { Bitset } from "libs/bitset/bitset.js"

const samples = 100_000

const a = true
const b = true
const c = 63

console.log("write")

const resArith = benchSync("arithmetic", () => {
  const bitset = new Bitset(c, 8)
  bitset.setBE(0, a)
  bitset.setBE(1, b)

  const x = bitset.unsigned()

  console.assert(x === 255)
}, { samples })

const resString = benchSync("string", () => {
  let bitset = c.toString(2).padStart(8, "0").split("")
  bitset[0] = a ? "1" : "0"
  bitset[1] = b ? "1" : "0"

  const x = parseInt(bitset.join(""), 2)

  console.assert(x === 255)
}, { samples })

resString.tableAndSummary(resArith)