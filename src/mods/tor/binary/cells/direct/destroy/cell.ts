import { Cursor } from "@hazae41/cursor"

export class DestroyCell {
  readonly #class = DestroyCell

  static readonly old = false
  static readonly circuit = true
  static readonly command = 4

  static readonly reasons = {
    NONE: 0,
    PROTOCOL: 1,
    INTERNAL: 2,
    REQUESTED: 3,
    HIBERNATING: 4,
    RESOURCELIMIT: 5,
    CONNECTFAILED: 6,
    OR_IDENTITY: 7,
    CHANNEL_CLOSED: 8,
    FINISHED: 9,
    TIMEOUT: 10,
    DESTROYED: 11,
    NOSUCHSERVICE: 12
  } as const

  constructor(
    readonly reason: number
  ) { }

  get command() {
    return this.#class.command
  }

  sizeOrThrow() {
    return 1
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.reason)
  }

  static readOrThrow(cursor: Cursor) {
    const code = cursor.readUint8OrThrow()

    cursor.offset += cursor.remaining

    return new DestroyCell(code)
  }

}