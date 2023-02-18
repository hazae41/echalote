import { Opaque, Writable } from "@hazae41/binary";
import { Naberius, unpack } from "@hazae41/naberius";
import { test } from "@hazae41/phobos";
import { TurboFrame } from "./frame.js";

test("turbo frame", async ({ test }) => {
  await Naberius.initBundledOnce()

  const frame = new TurboFrame(false, Opaque.random(130))
  console.log(Writable.toBytes(frame))
  console.log(unpack(Writable.toBytes(frame).subarray(0, 3)))
})