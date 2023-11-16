import { Cursor } from "@hazae41/cursor";
import { RelayEndReason, RelayEndReasonExitPolicy, RelayEndReasonOther } from "mods/tor/binary/cells/relayed/relay_end/reason.js";

export class RelayEndCell {
  readonly #class = RelayEndCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 3

  static readonly reasons = {
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
    readonly reason: RelayEndReason
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand(): 3 {
    return this.#class.rcommand
  }

  sizeOrThrow() {
    return 1 + this.reason.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.reason.id)
    this.reason.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    const reasonId = cursor.readUint8OrThrow()

    const reason = reasonId === this.reasons.REASON_EXITPOLICY
      ? RelayEndReasonExitPolicy.readOrThrow(cursor)
      : new RelayEndReasonOther(reasonId)

    return new RelayEndCell(reason)
  }

}