import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { SecretCircuit } from "mods/tor/circuit.js";

export interface CreateFastCellInit {
  readonly material: Bytes<20>
}

export class CreateFastCell {
  readonly #class = CreateFastCell

  static command = 5

  /**
   * The CREATE_FAST cell
   * @param material Key material (X) [20]
   */
  constructor(
    readonly circuit: SecretCircuit,
    readonly material: Bytes<20>
  ) { }

  static init(circuit: SecretCircuit, init: CreateFastCellInit) {
    const { material } = init

    return new CreateFastCell(circuit, material)
  }

  get command() {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(this.material.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return cursor.tryWrite(this.material)
  }

  static tryRead(cursor: Cursor): Result<CreateFastCellInit, BinaryReadError> {
    return Result.unthrowSync(t => {
      const slice = cursor.tryRead(20).throw(t)
      const material = Bytes.from(slice)

      cursor.offset += cursor.remaining

      return new Ok({ material })
    })
  }

}