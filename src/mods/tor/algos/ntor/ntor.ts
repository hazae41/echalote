import { Binary } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export function request(
  publicx: Uint8Array,
  idh: Uint8Array,
  oid: Uint8Array
) {
  const binary = Binary.allocUnsafe(20 + 32 + 32)

  binary.write(idh)
  binary.write(oid)
  binary.write(publicx)

  return binary.buffer
}

export function response(data: Uint8Array) {
  const binary = new Binary(data)

  const publicy = binary.read(32)
  const auth = binary.read(32)

  return { publicy, auth }
}

export interface NtorResult {
  auth: Uint8Array,
  nonce: Uint8Array,
  forwardDigest: Uint8Array,
  backwardDigest: Uint8Array,
  forwardKey: Uint8Array,
  backwardKey: Uint8Array
}

export async function finalize(
  sharedxy: Uint8Array,
  sharedxb: Uint8Array,
  publici: Uint8Array,
  publicb: Uint8Array,
  publicx: Uint8Array,
  publicy: Uint8Array
): Promise<NtorResult> {
  const protoid = "ntor-curve25519-sha256-1"

  const secreti = Binary.allocUnsafe(32 + 32 + 20 + 32 + 32 + 32 + protoid.length)
  secreti.write(sharedxy)
  secreti.write(sharedxb)
  secreti.write(publici)
  secreti.write(publicb)
  secreti.write(publicx)
  secreti.write(publicy)
  secreti.writeString(protoid)

  const t_mac = Bytes.fromUtf8(`${protoid}:mac`)
  const t_key = Bytes.fromUtf8(`${protoid}:key_extract`)
  const t_verify = Bytes.fromUtf8(`${protoid}:verify`)

  const hmac = { name: "HMAC", hash: "SHA-256" }

  const kt_verify = await crypto.subtle.importKey("raw", t_verify, hmac, false, ["sign"])
  const verify = new Uint8Array(await crypto.subtle.sign("HMAC", kt_verify, secreti.buffer))

  const server = "Server"

  const authi = Binary.allocUnsafe(32 + 20 + 32 + 32 + 32 + protoid.length + server.length)
  authi.write(verify)
  authi.write(publici)
  authi.write(publicb)
  authi.write(publicy)
  authi.write(publicx)
  authi.writeString(protoid)
  authi.writeString(server)

  const kt_mac = await crypto.subtle.importKey("raw", t_mac, hmac, false, ["sign"])
  const auth = new Uint8Array(await crypto.subtle.sign("HMAC", kt_mac, authi.buffer))

  const m_expand = Bytes.fromUtf8(`${protoid}:key_expand`)

  const hkdf = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key }
  const ksecret = await crypto.subtle.importKey("raw", secreti.buffer, "HKDF", false, ["deriveBits"])
  const key = new Uint8Array(await crypto.subtle.deriveBits(hkdf, ksecret, 8 * ((HASH_LEN * 3) + (KEY_LEN * 2))))

  const k = new Binary(key)
  const forwardDigest = k.read(HASH_LEN)
  const backwardDigest = k.read(HASH_LEN)
  const forwardKey = k.read(KEY_LEN)
  const backwardKey = k.read(KEY_LEN)
  const nonce = k.read(HASH_LEN)

  return { forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce }
}