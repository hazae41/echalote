import { Binary } from "@hazae41/binary"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export function request(
  publicx: Buffer,
  idh: Buffer,
  oid: Buffer
) {
  const binary = Binary.allocUnsafe(20 + 32 + 32)

  binary.write(idh)
  binary.write(oid)
  binary.write(publicx)

  return binary.buffer
}

export function response(data: Buffer) {
  const binary = new Binary(data)

  const publicy = binary.read(32)
  const auth = binary.read(32)

  return { publicy, auth }
}

export interface NtorResult {
  auth: Buffer,
  nonce: Buffer,
  forwardDigest: Buffer,
  backwardDigest: Buffer,
  forwardKey: Buffer,
  backwardKey: Buffer
}

export async function finalize(
  sharedxy: Buffer,
  sharedxb: Buffer,
  publici: Buffer,
  publicb: Buffer,
  publicx: Buffer,
  publicy: Buffer
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

  const t_mac = Buffer.from(`${protoid}:mac`)
  const t_key = Buffer.from(`${protoid}:key_extract`)
  const t_verify = Buffer.from(`${protoid}:verify`)

  const hmac = { name: "HMAC", hash: "SHA-256" }

  const kt_verify = await crypto.subtle.importKey("raw", t_verify, hmac, false, ["sign"])
  const verify = Buffer.from(await crypto.subtle.sign("HMAC", kt_verify, secreti.buffer))

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
  const auth = Buffer.from(await crypto.subtle.sign("HMAC", kt_mac, authi.buffer))

  const m_expand = Buffer.from(`${protoid}:key_expand`)

  const hkdf = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key }
  const ksecret = await crypto.subtle.importKey("raw", secreti.buffer, "HKDF", false, ["deriveBits"])
  const key = Buffer.from(await crypto.subtle.deriveBits(hkdf, ksecret, 8 * ((HASH_LEN * 3) + (KEY_LEN * 2))))

  const k = new Binary(key)
  const forwardDigest = k.read(HASH_LEN)
  const backwardDigest = k.read(HASH_LEN)
  const forwardKey = k.read(KEY_LEN)
  const backwardKey = k.read(KEY_LEN)
  const nonce = k.read(HASH_LEN)

  return { forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce }
}