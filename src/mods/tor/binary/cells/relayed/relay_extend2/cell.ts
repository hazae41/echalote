import { Writable } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { RelayExtend2Link } from "mods/tor/binary/cells/relayed/relay_extend2/link.js"

export class RelayExtend2Cell<T extends Writable> {
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

  sizeOrThrow() {
    return 0
      + 1
      + this.links.reduce((p, c) => p + c.sizeOrThrow(), 0)
      + 2
      + 2
      + this.data.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.links.length)

    for (const link of this.links)
      link.writeOrThrow(cursor)

    cursor.writeUint16OrThrow(this.type)

    const size = this.data.sizeOrThrow()
    cursor.writeUint16OrThrow(size)

    this.data.writeOrThrow(cursor)
  }

}