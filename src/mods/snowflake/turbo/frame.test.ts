import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { assert, test } from "@hazae41/phobos";
import { webcrypto } from "crypto";
import { relative, resolve } from "path";
import { TurboFrame } from "./frame.js";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))

globalThis.crypto = webcrypto as any

test("turbo frame", async ({ test }) => {
  const frame = TurboFrame.tryNew({ padding: false, fragment: Opaque.random(130) }).unwrap()
  const bytes = Writable.tryWriteToBytes(frame).unwrap()
  const frame2 = Readable.tryReadFromBytes(TurboFrame, bytes).unwrap()

  assert(Bytes.equals2(frame.fragment.bytes, frame2.fragment.bytes))
})