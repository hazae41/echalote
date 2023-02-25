import { Cursor } from "@hazae41/binary"
import { RelayEarlyCell } from "mods/tor/binary/cells/direct/relay_early/cell.js"
import { RelayExtend2Link } from "mods/tor/binary/cells/relayed/relay_extend2/link.js"
import { Circuit } from "mods/tor/circuit.js"
import { PAYLOAD_LEN } from "mods/tor/constants.js"

export class RelayExtend2Cell {
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
    readonly data: Uint8Array
  ) { }

  cell() {
    const cursor = Cursor.allocUnsafe(PAYLOAD_LEN)

    cursor.writeUint8(this.links.length)

    for (const link of this.links)
      link.write(cursor)

    cursor.writeUint16(this.type)
    cursor.writeUint16(this.data.length)
    cursor.write(this.data)

    return new RelayEarlyCell(this.circuit, this.stream, this.#class.rcommand, cursor.before)
  }
}