import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { assert, test } from "@hazae41/phobos";
import { webcrypto } from "crypto";
import { relative, resolve } from "path";
import { KcpSegment } from "./segment.js";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))

globalThis.crypto = webcrypto as any

test("kcp segment", async ({ test }) => {
  const frame = new KcpSegment(12345, KcpSegment.commands.push, 0, 65535, Date.now() / 1000, 0, 0, Opaque.random(130))
  const bytes = Writable.toBytes(frame.prepare())
  const frame2 = Readable.fromBytes(KcpSegment, bytes)

  assert(Bytes.equals(frame.fragment.bytes, frame2.fragment.bytes))
})