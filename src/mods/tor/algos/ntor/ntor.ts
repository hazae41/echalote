import { Cursor } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export class Response {

  constructor(
    readonly public_y: Uint8Array,
    readonly auth: Uint8Array
  ) { }

  static read(cursor: Cursor) {
    const publicY = cursor.read(32)
    const auth = cursor.read(32)

    return new this(publicY, auth)
  }

}

export class Request {

  constructor(
    readonly public_x: Uint8Array,
    readonly rsa_id_hash: Uint8Array,
    readonly onion_id: Uint8Array
  ) { }

  size() {
    return 20 + 32 + 32
  }

  write(cursor: Cursor) {
    cursor.write(this.rsa_id_hash)
    cursor.write(this.onion_id)
    cursor.write(this.public_x)
  }

}

export interface Result {
  auth: Uint8Array,
  nonce: Uint8Array,
  forwardDigest: Uint8Array,
  backwardDigest: Uint8Array,
  forwardKey: Uint8Array,
  backwardKey: Uint8Array
}

export async function finalize(
  shared_xy: Uint8Array,
  shared_xb: Uint8Array,
  rsa_id_hash: Uint8Array,
  public_b: Uint8Array,
  public_x: Uint8Array,
  public_y: Uint8Array
): Promise<Result> {
  const protoid = "ntor-curve25519-sha256-1"

  const secreti = Cursor.allocUnsafe(32 + 32 + 20 + 32 + 32 + 32 + protoid.length)
  secreti.write(shared_xy)
  secreti.write(shared_xb)
  secreti.write(rsa_id_hash)
  secreti.write(public_b)
  secreti.write(public_x)
  secreti.write(public_y)
  secreti.writeString(protoid)

  const t_mac = Bytes.fromUtf8(`${protoid}:mac`)
  const t_key = Bytes.fromUtf8(`${protoid}:key_extract`)
  const t_verify = Bytes.fromUtf8(`${protoid}:verify`)

  const hmac = { name: "HMAC", hash: "SHA-256" }

  const kt_verify = await crypto.subtle.importKey("raw", t_verify, hmac, false, ["sign"])
  const verify = new Uint8Array(await crypto.subtle.sign("HMAC", kt_verify, secreti.bytes))

  const server = "Server"

  const authi = Cursor.allocUnsafe(32 + 20 + 32 + 32 + 32 + protoid.length + server.length)
  authi.write(verify)
  authi.write(rsa_id_hash)
  authi.write(public_b)
  authi.write(public_y)
  authi.write(public_x)
  authi.writeString(protoid)
  authi.writeString(server)

  const kt_mac = await crypto.subtle.importKey("raw", t_mac, hmac, false, ["sign"])
  const auth = new Uint8Array(await crypto.subtle.sign("HMAC", kt_mac, authi.bytes))

  const m_expand = Bytes.fromUtf8(`${protoid}:key_expand`)

  const hkdf = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key }
  const ksecret = await crypto.subtle.importKey("raw", secreti.bytes, "HKDF", false, ["deriveBits"])
  const key = new Uint8Array(await crypto.subtle.deriveBits(hkdf, ksecret, 8 * ((HASH_LEN * 3) + (KEY_LEN * 2))))

  const k = new Cursor(key)
  const forwardDigest = k.read(HASH_LEN)
  const backwardDigest = k.read(HASH_LEN)
  const forwardKey = k.read(KEY_LEN)
  const backwardKey = k.read(KEY_LEN)
  const nonce = k.read(HASH_LEN)

  return { forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce }
}