import { Binary } from "libs/binary.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { RelayEndReason, RelayEndReasonExitPolicy, RelayEndReasonOther } from "mods/tor/binary/cells/relayed/relay_end/reason.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayEndCell {
  readonly #class = RelayEndCell

  static rcommand = 3

  static reasons = {
    REASON_UNKNOWN: 0,
    REASON_MISC: 1,
    REASON_RESOLVEFAILED: 2,
    REASON_CONNECTREFUSED: 3,
    REASON_EXITPOLICY: 4,
    REASON_DESTROY: 5,
    REASON_DONE: 6,
    REASON_TIMEOUT: 7,
    REASON_NOROUTE: 8,
    REASON_HIBERNATING: 9,
    REASON_INTERNAL: 10,
    REASON_RESOURCELIMIT: 11,
    REASON_CONNRESET: 12,
    REASON_TORPROTOCOL: 13,
    REASON_NOTDIRECTORY: 14,
  } as const

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream,
    readonly reason: RelayEndReason
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.reason.id)
    this.reason.write(binary)

    return new RelayCell(this.circuit, this.stream, this.#class.rcommand, binary.sliced)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const binary = new Binary(cell.data)

    const reasonId = binary.readUint8()

    const reason = reasonId === this.reasons.REASON_EXITPOLICY
      ? RelayEndReasonExitPolicy.read(binary)
      : new RelayEndReasonOther(reasonId)

    return new this(cell.circuit, cell.stream, reason)
  }
}