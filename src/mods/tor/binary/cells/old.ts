import { BinaryError, BinaryReadError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorClientDuplex } from "mods/tor/tor.js";
import { Cell } from "./cell.js";
import { Cellable } from "./cellable.js";

export class RawOldCell<T extends Writable.Infer<T>> {

  constructor(
    readonly circuit: number,
    readonly command: number,
    readonly payload: T
  ) { }

  tryUnpack(tor: SecretTorClientDuplex) {
    if (this.circuit === 0)
      return new OldCell.Circuitless(this.command, this.payload)

    const circuit = tor.circuits.inner.get(this.circuit)

    if (circuit === undefined)
      throw new Error(`Unknown circuit id ${this.circuit}`)

    return new OldCell.Circuitful(circuit, this.command, this.payload)
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    if (this.command === 7)
      return this.payload.trySize().mapSync(x => 2 + 1 + 2 + x)
    else
      return new Ok(2 + 1 + Cell.PAYLOAD_LEN)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      if (this.command === 7) {
        cursor.tryWriteUint16(this.circuit).throw(t)
        cursor.tryWriteUint8(this.command).throw(t)

        const size = this.payload.trySize().throw(t)
        cursor.tryWriteUint16(size).throw(t)

        this.payload.tryWrite(cursor).throw(t)

        return Ok.void()
      } else {
        cursor.tryWriteUint16(this.circuit).throw(t)
        cursor.tryWriteUint8(this.command).throw(t)

        const payload = cursor.tryRead(Cell.PAYLOAD_LEN).throw(t)
        const subcursor = new Cursor(payload)
        this.payload.tryWrite(subcursor).throw(t)
        subcursor.fill(0, subcursor.remaining)

        return Ok.void()
      }
    })
  }

  static tryRead(cursor: Cursor): Result<RawOldCell<Opaque>, BinaryReadError> {
    return Result.unthrowSync(t => {
      const circuit = cursor.tryReadUint16().throw(t)
      const command = cursor.tryReadUint8().throw(t)

      if (command === 7) {
        const length = cursor.tryReadUint16().throw(t)
        const bytes = cursor.tryRead(length).throw(t)
        const payload = new Opaque(bytes)

        return new Ok(new RawOldCell(circuit, command, payload))
      } else {
        const bytes = cursor.tryRead(Cell.PAYLOAD_LEN).throw(t)
        const payload = new Opaque(bytes)

        return new Ok(new RawOldCell(circuit, command, payload))
      }
    })
  }

}

export type OldCell<T extends Writable.Infer<T>> =
  | OldCell.Circuitful<T>
  | OldCell.Circuitless<T>

export namespace OldCell {

  export class Circuitful<T extends Writable.Infer<T>> {
    readonly #raw: RawOldCell<T>

    constructor(
      readonly circuit: SecretCircuit,
      readonly command: number,
      readonly payload: T
    ) {
      this.#raw = new RawOldCell<T>(circuit.id, command, payload)
    }

    static from<T extends Cellable.Circuitful<T>>(circuit: SecretCircuit, cellable: T) {
      return new Circuitful(circuit, cellable.command, cellable)
    }

    trySize(): Result<number, Writable.SizeError<T>> {
      return this.#raw.trySize()
    }

    tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
      return this.#raw.tryWrite(cursor)
    }

    static tryInto<ReadOutput extends Cellable.Circuitful<ReadOutput>, ReadError>(cell: Circuitful<Opaque>, readable: Readable<ReadOutput, ReadError>): Result<Circuitful<ReadOutput>, ReadError | BinaryReadError> {
      return cell.payload.tryInto(readable).mapSync(x => new Circuitful(cell.circuit, cell.command, x))
    }

  }

  export class Circuitless<T extends Writable.Infer<T>> {
    readonly #raw: RawOldCell<T>

    constructor(
      readonly command: number,
      readonly payload: T
    ) {
      this.#raw = new RawOldCell<T>(0, command, payload)
    }

    static from<T extends Cellable.Circuitless<T>>(cellable: T) {
      return new Circuitless(cellable.command, cellable)
    }

    trySize(): Result<number, Writable.SizeError<T>> {
      return this.#raw.trySize()
    }

    tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
      return this.#raw.tryWrite(cursor)
    }

    static tryInto<ReadOutput extends Cellable.Circuitless<ReadOutput>, ReadError>(cell: Circuitless<Opaque>, readable: Readable<ReadOutput, ReadError>): Result<Circuitless<ReadOutput>, ReadError | BinaryReadError> {
      return cell.payload.tryInto(readable).mapSync(x => new Circuitless(cell.command, x))
    }

  }
}