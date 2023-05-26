import { BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

export class VersionsCell {
  readonly #class = VersionsCell

  static readonly old = true
  static readonly circuit = false
  static readonly command = 7

  constructor(
    readonly versions: number[]
  ) { }

  get old(): true {
    return this.#class.old
  }

  get circuit(): false {
    return this.#class.circuit
  }

  get command(): 7 {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(2 * this.versions.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {

      for (const version of this.versions)
        cursor.tryWriteUint16(version).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<VersionsCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const versions = new Array<number>(cursor.remaining / 2)

      for (let i = 0; i < versions.length; i++)
        versions[i] = cursor.tryReadUint16().throw(t)

      return new Ok(new VersionsCell(versions))
    })
  }

}