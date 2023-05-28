import { BinaryReadError } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Err, Ok, Panic, Result, Unimplemented } from "@hazae41/result"
import { ExpiredCertError } from "mods/tor/certs/certs.js"

export class CrossCert {
  readonly #class = CrossCert

  static types = {
    RSA_TO_ED: 7
  }

  constructor(
    readonly type: number,
    readonly key: Bytes<32>,
    readonly expiration: Date,
    readonly payload: Uint8Array,
    readonly signature: Uint8Array
  ) { }

  tryVerify(): Result<void, ExpiredCertError> {
    const now = new Date()

    if (now > this.expiration)
      return new Err(new ExpiredCertError())

    return Ok.void()
  }

  trySize(): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  tryWrite(cursor: Cursor): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  static tryRead(cursor: Cursor): Result<CrossCert, BinaryReadError> {
    return Result.unthrowSync(t => {
      const type = cursor.tryReadUint8().throw(t)
      const length = cursor.tryReadUint16().throw(t)

      const start = cursor.offset

      const key = cursor.tryRead(32).throw(t)

      const expDateHours = cursor.tryReadUint32().throw(t)
      const expiration = new Date(expDateHours * 60 * 60 * 1000)

      const content = cursor.offset - start

      cursor.offset = start

      const payload = cursor.tryRead(content).throw(t)

      const sigLength = cursor.tryReadUint8().throw(t)
      const signature = cursor.tryRead(sigLength).throw(t)

      return new Ok(new CrossCert(type, key, expiration, payload, signature))
    })
  }
}