import { Cursor, Writable } from "@hazae41/binary"
import { RelayExtend2Link } from "mods/tor/binary/cells/relayed/relay_extend2/link.js"
import { Circuit } from "mods/tor/circuit.js"

export class RelayExtend2Cell<T extends Writable> {
  readonly #class = RelayExtend2Cell

  static rcommand = 14

  static types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
  }

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly type: number,
    readonly links: RelayExtend2Link[],
    readonly data: T
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return 0
      + 1
      + this.links.reduce((p, c) => p + c.size(), 0)
      + 2
      + 2
      + this.data.size()
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.links.length)

    for (const link of this.links)
      link.write(cursor)

    cursor.writeUint16(this.type)
    cursor.writeUint16(this.data.size())
    this.data.write(cursor)
  }

}