import { Bytes, Uint8Array } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export class InvalidNtorAuthError extends Error {
  readonly #class = InvalidNtorAuthError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid Ntor auth`)
  }

}

export class NtorResponse {

  constructor(
    readonly public_y: Uint8Array<32>,
    readonly auth: Uint8Array<32>
  ) { }

  static readOrThrow(cursor: Cursor) {
    const publicY = cursor.readAndCopyOrThrow(32)
    const auth = cursor.readAndCopyOrThrow(32)

    return new NtorResponse(publicY, auth)
  }

}

export class NtorRequest {

  constructor(
    readonly public_x: Uint8Array<32>,
    readonly relayid_rsa: Uint8Array<20>,
    readonly ntor_onion_key: Uint8Array<32>
  ) { }

  sizeOrThrow() {
    return 0
      + this.relayid_rsa.length
      + this.ntor_onion_key.length
      + this.public_x.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.relayid_rsa)
    cursor.writeOrThrow(this.ntor_onion_key)
    cursor.writeOrThrow(this.public_x)
  }

}

export interface NtorResult {
  readonly auth: Uint8Array<32>,
  readonly nonce: Uint8Array<HASH_LEN>,
  readonly forwardDigest: Uint8Array<HASH_LEN>,
  readonly backwardDigest: Uint8Array<HASH_LEN>,
  readonly forwardKey: Uint8Array<KEY_LEN>,
  readonly backwardKey: Uint8Array<KEY_LEN>
}

export namespace NtorResult {

  export async function finalizeOrThrow(
    shared_xy: Uint8Array<32>,
    shared_xb: Uint8Array<32>,
    relayid_rsa: Uint8Array<20>,
    public_b: Uint8Array<32>,
    public_x: Uint8Array<32>,
    public_y: Uint8Array<32>
  ): Promise<NtorResult> {
    const protoid = "ntor-curve25519-sha256-1"

    const secret_input = new Cursor(new Uint8Array(32 + 32 + 20 + 32 + 32 + 32 + protoid.length))
    secret_input.writeOrThrow(shared_xy)
    secret_input.writeOrThrow(shared_xb)
    secret_input.writeOrThrow(relayid_rsa)
    secret_input.writeOrThrow(public_b)
    secret_input.writeOrThrow(public_x)
    secret_input.writeOrThrow(public_y)
    secret_input.writeUtf8OrThrow(protoid)

    const t_mac = Bytes.fromUtf8(`${protoid}:mac`)
    const t_key = Bytes.fromUtf8(`${protoid}:key_extract`)
    const t_verify = Bytes.fromUtf8(`${protoid}:verify`)

    const kt_verify = await crypto.subtle.importKey("raw", t_verify, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const verify = new Uint8Array(await crypto.subtle.sign("HMAC", kt_verify, secret_input.bytes))

    const server = "Server"

    const auth_input = new Cursor(new Uint8Array(32 + 20 + 32 + 32 + 32 + protoid.length + server.length))
    auth_input.writeOrThrow(verify)
    auth_input.writeOrThrow(relayid_rsa)
    auth_input.writeOrThrow(public_b)
    auth_input.writeOrThrow(public_y)
    auth_input.writeOrThrow(public_x)
    auth_input.writeUtf8OrThrow(protoid)
    auth_input.writeUtf8OrThrow(server)

    const t_mac_key = await crypto.subtle.importKey("raw", t_mac, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const auth = new Uint8Array(await crypto.subtle.sign("HMAC", t_mac_key, auth_input.bytes)) as Uint8Array<32>

    const m_expand = Bytes.fromUtf8(`${protoid}:key_expand`)

    const secret_input_key = await crypto.subtle.importKey("raw", secret_input.bytes, "HKDF", false, ["deriveBits"])
    const key_params = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key }
    const key_bytes = new Uint8Array(await crypto.subtle.deriveBits(key_params, secret_input_key, 8 * ((HASH_LEN * 3) + (KEY_LEN * 2))))

    const key = new Cursor(key_bytes)
    const forwardDigest = key.readAndCopyOrThrow(HASH_LEN)
    const backwardDigest = key.readAndCopyOrThrow(HASH_LEN)
    const forwardKey = key.readAndCopyOrThrow(KEY_LEN)
    const backwardKey = key.readAndCopyOrThrow(KEY_LEN)
    const nonce = key.readAndCopyOrThrow(HASH_LEN)

    return { forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce }
  }

}