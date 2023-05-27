import { BinaryWriteError, Writable } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"
import { RelayExtend2Link } from "mods/tor/binary/cells/relayed/relay_extend2/link.js"

export class RelayExtend2Cell<T extends Writable.Infer<T>> {
  readonly #class = RelayExtend2Cell

  static readonly early = true
  static readonly stream = false
  static readonly rcommand = 14

  static readonly types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
  } as const

  constructor(
    readonly type: number,
    readonly links: RelayExtend2Link[],
    readonly data: T
  ) { }

  get early(): true {
    return this.#class.early
  }

  get stream(): false {
    return this.#class.stream
  }

  get rcommand(): 14 {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.data.trySize().mapSync(x => 0
      + 1
      + this.links.reduce((p, c) => p + c.trySize().get(), 0)
      + 2
      + 2
      + x)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.links.length).throw(t)

      for (const link of this.links)
        link.tryWrite(cursor).throw(t)

      cursor.tryWriteUint16(this.type).throw(t)

      const size = this.data.trySize().throw(t)
      cursor.tryWriteUint16(size).throw(t)

      this.data.tryWrite(cursor)

      return Ok.void()
    })
  }

}