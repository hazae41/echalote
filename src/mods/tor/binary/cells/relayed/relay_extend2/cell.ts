import { Binary } from "libs/binary.js"
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
    readonly data: Buffer
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.links.length)

    for (const link of this.links)
      link.write(binary)

    binary.writeUint16(this.type)
    binary.writeUint16(this.data.length)
    binary.write(this.data)

    return new RelayEarlyCell(this.circuit, this.stream, this.#class.rcommand, binary.sliced)
  }
}