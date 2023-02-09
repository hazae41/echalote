import { assert, test, throws } from "@hazae41/phobos";
import { Bitset } from "libs/bitset/bitset.js";
import { relative, resolve } from "node:path";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))

function format(bitmask: Bitset) {
  return bitmask.unsigned().toString(2).padStart(bitmask.length, "0")
}

test("Identity", async () => {
  const bitmask = new Bitset(0b00000000, 8)

  assert(bitmask.getBE(0) === false)
  assert(format(bitmask) === "00000000")
})

test("Enable then disable", async () => {
  const bitmask = new Bitset(0b00000000, 8)

  bitmask.enableLE(1)
  assert(bitmask.getLE(1) === true)
  assert(format(bitmask) === "00000010")

  bitmask.disableLE(1)
  assert(bitmask.getLE(1) === false)
  assert(format(bitmask) === "00000000")

  bitmask.enableBE(1)
  assert(bitmask.getBE(1) === true)
  assert(format(bitmask) === "01000000")

  bitmask.disableBE(1)
  assert(bitmask.getBE(1) === false)
  assert(format(bitmask) === "00000000")
})

test("Toggle then toggle", async () => {
  const bitmask = new Bitset(0b00000000, 8)

  bitmask.toggleLE(1)
  assert(bitmask.getLE(1) === true)
  assert(format(bitmask) === "00000010")

  bitmask.toggleLE(1)
  assert(bitmask.getLE(1) === false)
  assert(format(bitmask) === "00000000")

  bitmask.toggleBE(1)
  assert(bitmask.getBE(1) === true)
  assert(format(bitmask) === "01000000")

  bitmask.toggleBE(1)
  assert(bitmask.getBE(1) === false)
  assert(format(bitmask) === "00000000")
})

test("Export Int32 to Uint32", async () => {
  const bitmask = new Bitset(0, 32)

  bitmask.toggleBE(0) // -2147483648

  const buffer = Buffer.alloc(4)

  assert(throws(() => buffer.writeUInt32BE(bitmask.value, 0)), `Writing value should throw`)
  assert(!throws(() => buffer.writeUInt32BE(bitmask.unsigned(), 0)), `Writing unsigned value should not throw`)
})

test("First", async () => {
  const bitmask = new Bitset(0b11100011, 8)

  assert(bitmask.first(2) === 3)
  assert(bitmask.first(3) === 7)
})

test("Last", async () => {
  const bitmask = new Bitset(0b11100111, 8)

  assert(bitmask.last(2) === 3)
  assert(bitmask.last(3) === 7)
})