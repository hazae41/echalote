import { Uint8Array } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";

export class CreatedFastCell {
  readonly #class = CreatedFastCell

  static readonly old = false
  static readonly circuit = true
  static readonly command = 6

  constructor(
    readonly material: Uint8Array<20>,
    readonly derivative: Uint8Array<20>
  ) { }

  get command() {
    return this.#class.command
  }

  sizeOrThrow() {
    return this.material.length + this.derivative.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.material)
    cursor.writeOrThrow(this.derivative)
  }

  static readOrThrow(cursor: Cursor) {
    const material = cursor.readAndCopyOrThrow(20)
    const derivative = cursor.readAndCopyOrThrow(20)

    cursor.offset += cursor.remaining

    return new CreatedFastCell(material, derivative)
  }

}