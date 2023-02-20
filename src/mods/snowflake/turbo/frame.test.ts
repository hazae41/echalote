import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Naberius } from "@hazae41/naberius";
import { assert, test } from "@hazae41/phobos";
import { TurboFrame } from "./frame.js";

test("turbo frame", async ({ test }) => {
  await Naberius.initBundledOnce()

  const frame = new TurboFrame(false, Opaque.random(130))
  const bytes = Writable.toBytes(frame)
  const frame2 = Readable.fromBytes(TurboFrame, bytes)

  assert(Bytes.equals(frame.fragment.bytes, frame2.fragment.bytes))
})