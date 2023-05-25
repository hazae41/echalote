import { BinaryError, BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export class NtorResponse {

  constructor(
    readonly public_y: Bytes<32>,
    readonly auth: Bytes<32>
  ) { }

  static tryRead(cursor: Cursor): Result<NtorResponse, BinaryReadError> {
    return Result.unthrowSync(t => {
      const publicY = cursor.tryRead(32).throw(t)
      const auth = cursor.tryRead(32).throw(t)

      return new Ok(new NtorResponse(publicY, auth))
    })
  }

}

export class NtorRequest {

  constructor(
    readonly public_x: Bytes<20>,
    readonly relayid_rsa: Bytes<32>,
    readonly ntor_onion_key: Bytes<32>
  ) { }

  trySize(): Result<number, never> {
    return new Ok(0
      + this.public_x.length
      + this.relayid_rsa.length
      + this.ntor_onion_key.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWrite(this.relayid_rsa).throw(t)
      cursor.tryWrite(this.ntor_onion_key).throw(t)
      cursor.tryWrite(this.public_x).throw(t)

      return Ok.void()
    })
  }

}

export interface NtorResult {
  auth: Uint8Array,
  nonce: Uint8Array,
  forwardDigest: Uint8Array,
  backwardDigest: Uint8Array,
  forwardKey: Uint8Array,
  backwardKey: Uint8Array
}

export namespace NtorResult {

  export async function tryFinalize(
    shared_xy: Bytes<32>,
    shared_xb: Bytes<32>,
    relayid_rsa: Bytes<20>,
    public_b: Bytes<32>,
    public_x: Bytes<32>,
    public_y: Bytes<32>
  ): Promise<Result<NtorResult, BinaryError>> {
    return await Result.unthrow(async t => {
      const protoid = "ntor-curve25519-sha256-1"

      const secret_input = Cursor.allocUnsafe(32 + 32 + 20 + 32 + 32 + 32 + protoid.length)
      secret_input.tryWrite(shared_xy).throw(t)
      secret_input.tryWrite(shared_xb).throw(t)
      secret_input.tryWrite(relayid_rsa).throw(t)
      secret_input.tryWrite(public_b).throw(t)
      secret_input.tryWrite(public_x).throw(t)
      secret_input.tryWrite(public_y).throw(t)
      secret_input.tryWriteString(protoid).throw(t)

      const t_mac = Bytes.fromUtf8(`${protoid}:mac`)
      const t_key = Bytes.fromUtf8(`${protoid}:key_extract`)
      const t_verify = Bytes.fromUtf8(`${protoid}:verify`)

      const kt_verify = await crypto.subtle.importKey("raw", t_verify, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      const verify = new Uint8Array(await crypto.subtle.sign("HMAC", kt_verify, secret_input.bytes))

      const server = "Server"

      const auth_input = Cursor.allocUnsafe(32 + 20 + 32 + 32 + 32 + protoid.length + server.length)
      auth_input.tryWrite(verify).throw(t)
      auth_input.tryWrite(relayid_rsa).throw(t)
      auth_input.tryWrite(public_b).throw(t)
      auth_input.tryWrite(public_y).throw(t)
      auth_input.tryWrite(public_x).throw(t)
      auth_input.tryWriteString(protoid).throw(t)
      auth_input.tryWriteString(server).throw(t)

      const t_mac_key = await crypto.subtle.importKey("raw", t_mac, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      const auth = new Uint8Array(await crypto.subtle.sign("HMAC", t_mac_key, auth_input.bytes))

      const m_expand = Bytes.fromUtf8(`${protoid}:key_expand`)

      const secret_input_key = await crypto.subtle.importKey("raw", secret_input.bytes, "HKDF", false, ["deriveBits"])
      const key_params = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key }
      const key_bytes = new Uint8Array(await crypto.subtle.deriveBits(key_params, secret_input_key, 8 * ((HASH_LEN * 3) + (KEY_LEN * 2))))

      const key = new Cursor(key_bytes)
      const forwardDigest = key.tryRead(HASH_LEN).throw(t)
      const backwardDigest = key.tryRead(HASH_LEN).throw(t)
      const forwardKey = key.tryRead(KEY_LEN).throw(t)
      const backwardKey = key.tryRead(KEY_LEN).throw(t)
      const nonce = key.tryRead(HASH_LEN).throw(t)

      return new Ok({ forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce })
    })
  }

}