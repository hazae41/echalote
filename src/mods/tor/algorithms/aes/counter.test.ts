import { Bytes } from "@hazae41/bytes"
import { assert, test } from "@hazae41/phobos"
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar"
import { BigInts } from "libs/bigint/bigint.js"
import { AesCounter } from "./counter.js"

await Zepar.initBundledOnce()

async function assertEncrypt(key: AesCounter, key2: Aes128Ctr128BEKey, data: Uint8Array) {
  const cipher = new Uint8Array(await key.encrypt(data))
  const cipher2 = key2.apply_keystream(data).copyAndDispose()
  console.log(cipher, cipher2)
  // assert(Bytes.equals(cipher, cipher2))
  return cipher
}

async function assertDecrypt(key: AesCounter, key2: Aes128Ctr128BEKey, data: Uint8Array) {
  const cipher = new Uint8Array(await key.decrypt(data))
  const cipher2 = new Uint8Array(data)
  key2.apply_keystream(cipher2)
  assert(Bytes.equals(cipher, cipher2))
  return cipher
}

test("AES encryption", async ({ test }) => {
  const rawKey = Bytes.random(16)

  const ekey = await AesCounter.from(rawKey, 0n)
  const ekey2 = new Aes128Ctr128BEKey(rawKey, new Uint8Array(16))

  const dkey = await AesCounter.from(rawKey, 0n)
  const dkey2 = new Aes128Ctr128BEKey(rawKey, new Uint8Array(16))

  const data = new Uint8Array(17)

  const cipher = await assertEncrypt(ekey, ekey2, data)

  {
    const counter0 = BigInts.tryExport(ekey.counter).unwrap()
    const counter = Bytes.tryPadStart(counter0, 16).unwrap()
    console.log("counter2", counter)

    console.log("counter", ekey2.iv_state().copyAndDispose())
  }

  const cipher2 = await assertEncrypt(ekey, ekey2, data)

  {
    const counter0 = BigInts.tryExport(ekey.counter).unwrap()
    const counter = Bytes.tryPadStart(counter0, 16).unwrap()
    console.log("counter2", counter)

    console.log("counter", ekey2.iv_state().copyAndDispose())
  }

  const recipher = await assertDecrypt(dkey, dkey2, cipher2)
  const redata = await assertDecrypt(dkey, dkey2, recipher)

  assert(Bytes.equals2(data, redata))
})