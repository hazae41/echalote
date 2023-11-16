import { Opaque, Writable } from "@hazae41/binary";
import { Uint8Array } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";

export class RelaySendmeCircuitCell<T extends Writable> {
  readonly #class = RelaySendmeCircuitCell

  static readonly early = false
  static readonly stream = false
  static readonly rcommand = 5

  static readonly versions = {
    0: 0,
    1: 1
  } as const

  constructor(
    readonly version: number,
    readonly fragment: T
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): false {
    return this.#class.stream
  }

  get rcommand(): 5 {
    return this.#class.rcommand
  }

  sizeOrThrow() {
    return 1 + 2 + this.fragment.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    cursor.tryWriteUint8(this.version)

    const size = this.fragment.sizeOrThrow()
    cursor.tryWriteUint16(size)

    this.fragment.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    const version = cursor.readUint8OrThrow()
    const length = cursor.readUint16OrThrow()
    const bytes = cursor.readAndCopyOrThrow(length)
    const data = new Opaque(bytes)

    return new RelaySendmeCircuitCell(version, data)
  }

}

export class RelaySendmeStreamCell {
  readonly #class = RelaySendmeStreamCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 5

  static readonly versions = {
    0: 0,
    1: 1
  } as const

  constructor() { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand(): 5 {
    return this.#class.rcommand
  }

  sizeOrThrow() {
    return 0
  }

  writeOrThrow(cursor: Cursor) {
    return
  }

  static readOrThrow(cursor: Cursor) {
    return new RelaySendmeStreamCell()
  }

}

export class RelaySendmeDigest {

  constructor(
    readonly digest: Uint8Array<20>
  ) { }

  sizeOrThrow() {
    return this.digest.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.digest)
  }

  static readOrThrow(cursor: Cursor) {
    return new RelaySendmeDigest(cursor.readAndCopyOrThrow(20))
  }

}