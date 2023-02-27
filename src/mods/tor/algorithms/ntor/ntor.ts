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
    readonly relayid_rsa: Uint8Array,
    readonly ntor_onion_key: Uint8Array
  ) { }

  size() {
    return 20 + 32 + 32
  }

  write(cursor: Cursor) {
    cursor.write(this.relayid_rsa)
    cursor.write(this.ntor_onion_key)
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
  relayid_rsa: Uint8Array,
  public_b: Uint8Array,
  public_x: Uint8Array,
  public_y: Uint8Array
): Promise<Result> {
  const protoid = "ntor-curve25519-sha256-1"

  const secret_input = Cursor.allocUnsafe(32 + 32 + 20 + 32 + 32 + 32 + protoid.length)
  secret_input.write(shared_xy)
  secret_input.write(shared_xb)
  secret_input.write(relayid_rsa)
  secret_input.write(public_b)
  secret_input.write(public_x)
  secret_input.write(public_y)
  secret_input.writeString(protoid)

  const t_mac = Bytes.fromUtf8(`${protoid}:mac`)
  const t_key = Bytes.fromUtf8(`${protoid}:key_extract`)
  const t_verify = Bytes.fromUtf8(`${protoid}:verify`)

  const kt_verify = await crypto.subtle.importKey("raw", t_verify, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const verify = new Uint8Array(await crypto.subtle.sign("HMAC", kt_verify, secret_input.bytes))

  const server = "Server"

  const auth_input = Cursor.allocUnsafe(32 + 20 + 32 + 32 + 32 + protoid.length + server.length)
  auth_input.write(verify)
  auth_input.write(relayid_rsa)
  auth_input.write(public_b)
  auth_input.write(public_y)
  auth_input.write(public_x)
  auth_input.writeString(protoid)
  auth_input.writeString(server)

  const t_mac_key = await crypto.subtle.importKey("raw", t_mac, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const auth = new Uint8Array(await crypto.subtle.sign("HMAC", t_mac_key, auth_input.bytes))

  const m_expand = Bytes.fromUtf8(`${protoid}:key_expand`)

  const secret_input_key = await crypto.subtle.importKey("raw", secret_input.bytes, "HKDF", false, ["deriveBits"])
  const key_params = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key }
  const key_bytes = new Uint8Array(await crypto.subtle.deriveBits(key_params, secret_input_key, 8 * ((HASH_LEN * 3) + (KEY_LEN * 2))))

  const key = new Cursor(key_bytes)
  const forwardDigest = key.read(HASH_LEN)
  const backwardDigest = key.read(HASH_LEN)
  const forwardKey = key.read(KEY_LEN)
  const backwardKey = key.read(KEY_LEN)
  const nonce = key.read(HASH_LEN)

  return { forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce }
}