import { Cursor, Opaque } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { RelayEndReason, RelayEndReasonExitPolicy, RelayEndReasonOther } from "mods/tor/binary/cells/relayed/relay_end/reason.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { TorStreamDuplex } from "mods/tor/stream.js";

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
    readonly circuit: SecretCircuit,
    readonly stream: TorStreamDuplex,
    readonly reason: RelayEndReason
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return 1 + this.reason.size()
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.reason.id)
    this.reason.write(cursor)
  }

  static read(cursor: Cursor) {
    const reasonId = cursor.readUint8()

    const reason = reasonId === this.reasons.REASON_EXITPOLICY
      ? RelayEndReasonExitPolicy.read(cursor)
      : new RelayEndReasonOther(reasonId)

    return { reason }
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const { reason } = cell.data.into(this)
    return new this(cell.circuit, cell.stream, reason)
  }
}