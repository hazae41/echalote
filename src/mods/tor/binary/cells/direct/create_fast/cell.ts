import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";

export interface CreateFastCellInit {
  readonly material: Bytes<20>
}

export class CreateFastCell {
  readonly #class = CreateFastCell

  static readonly old = false
  static readonly circuit = true
  static readonly command = 5

  /**
   * The CREATE_FAST cell
   * @param material Key material (X) [20]
   */
  constructor(
    readonly material: Bytes<20>
  ) { }

  get old(): false {
    return this.#class.old
  }

  get circuit(): true {
    return this.#class.circuit
  }

  get command(): 5 {
    return this.#class.command
  }

  sizeOrThrow() {
    return this.material.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.material)
  }

  static readOrThrow(cursor: Cursor) {
    const material = cursor.readAndCopyOrThrow(20)

    cursor.offset += cursor.remaining

    return new CreateFastCell(material)
  }

}