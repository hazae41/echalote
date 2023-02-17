import { Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Naberius, unpack } from "@hazae41/naberius";
import { test } from "@hazae41/phobos";
import { TurboFrame } from "./frame.js";

test("turbo frame", async ({ test }) => {
  await Naberius.initBundledOnce()

  const frame = new TurboFrame(false, Bytes.random(130))
  console.log(Writable.toBytes(frame))
  console.log(unpack(Writable.toBytes(frame).subarray(0, 3)))
})