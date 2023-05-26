import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { RelayEndReason, RelayEndReasonExitPolicy, RelayEndReasonOther } from "mods/tor/binary/cells/relayed/relay_end/reason.js";

export class RelayEndCell {
  readonly #class = RelayEndCell

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

  get rcommand() {
    return this.#class.rcommand
  }

  trySize(): Result<number, never> {
    return new Ok(1 + this.reason.trySize().get())
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.reason.id).throw(t)
      this.reason.tryWrite(cursor).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<RelayEndCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const reasonId = cursor.tryReadUint8().throw(t)

      const reason = reasonId === this.reasons.REASON_EXITPOLICY
        ? RelayEndReasonExitPolicy.tryRead(cursor).throw(t)
        : new RelayEndReasonOther(reasonId)

      return new Ok(new RelayEndCell(reason))
    })
  }

}