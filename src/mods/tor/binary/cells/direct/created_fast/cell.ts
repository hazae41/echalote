import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";

export class CreatedFastCell {
  readonly #class = CreatedFastCell

  static readonly old = false
  static readonly circuit = true
  static readonly command = 6

  constructor(
    readonly material: Bytes<20>,
    readonly derivative: Bytes<20>
  ) { }

  get command() {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(this.material.length + this.derivative.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWrite(this.material).throw(t)
      cursor.tryWrite(this.derivative).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<CreatedFastCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const material = Bytes.tryFromSized(cursor.tryRead(20).throw(t)).throw(t)
      const derivative = Bytes.tryFromSized(cursor.tryRead(20).throw(t)).throw(t)

      cursor.offset += cursor.remaining

      return new Ok(new CreatedFastCell(material, derivative))
    })
  }

}