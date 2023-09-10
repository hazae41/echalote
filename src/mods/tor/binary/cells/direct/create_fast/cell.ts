import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";

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

  trySize(): Result<number, never> {
    return new Ok(this.material.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return cursor.tryWrite(this.material)
  }

  static tryRead(cursor: Cursor): Result<CreateFastCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const material = Bytes.tryFromSized(cursor.tryRead(20).throw(t)).throw(t)

      cursor.offset += cursor.remaining

      return new Ok(new CreateFastCell(material))
    })
  }

}