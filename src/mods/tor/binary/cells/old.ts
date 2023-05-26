import { BinaryError, BinaryReadError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorClientDuplex } from "mods/tor/tor.js";
import { Cell, InvalidCircuitError, InvalidCommandError } from "./cell.js";
import { Cellable } from "./cellable.js";

export type OldCell<T extends Writable.Infer<T>> =
  | OldCell.Circuitful<T>
  | OldCell.Circuitless<T>

export namespace OldCell {

  export type PAYLOAD_LEN = 509
  export const PAYLOAD_LEN = 509

  export function tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: Cell<Opaque>, readable: Cellable & Readable<ReadOutput, ReadError>): Result<Cell<ReadOutput>, ReadError | BinaryReadError | InvalidCommandError | InvalidCircuitError> {
    if (readable.command !== cell.command)
      return new Err(new InvalidCommandError())
    if (readable.circuit !== Boolean(cell.circuit))
      return new Err(new InvalidCircuitError())

    return cell.tryMap(payload => payload.tryInto(readable))
  }

  export class Raw<T extends Writable.Infer<T>> {

    constructor(
      readonly circuit: number,
      readonly command: number,
      readonly payload: T
    ) { }

    tryUnpack(tor: SecretTorClientDuplex) {
      if (this.circuit === 0)
        return new Ok(new Circuitless(undefined, this.command, this.payload))

      const circuit = tor.circuits.inner.get(this.circuit)

      if (circuit === undefined)
        throw new Error(`Unknown circuit id ${this.circuit}`)

      return new Ok(new Circuitful(circuit, this.command, this.payload))
    }

    trySize(): Result<number, Writable.SizeError<T>> {
      if (this.command === 7)
        return this.payload.trySize().mapSync(x => 2 + 1 + 2 + x)
      else
        return new Ok(2 + 1 + PAYLOAD_LEN)
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

          const payload = cursor.tryRead(PAYLOAD_LEN).throw(t)
          const subcursor = new Cursor(payload)
          this.payload.tryWrite(subcursor).throw(t)
          subcursor.fill(0, subcursor.remaining)

          return Ok.void()
        }
      })
    }

    static tryRead(cursor: Cursor): Result<Raw<Opaque>, BinaryReadError> {
      return Result.unthrowSync(t => {
        const circuit = cursor.tryReadUint16().throw(t)
        const command = cursor.tryReadUint8().throw(t)

        if (command === 7) {
          const length = cursor.tryReadUint16().throw(t)
          const bytes = cursor.tryRead(length).throw(t)
          const payload = new Opaque(bytes)

          return new Ok(new Raw(circuit, command, payload))
        } else {
          const bytes = cursor.tryRead(PAYLOAD_LEN).throw(t)
          const payload = new Opaque(bytes)

          return new Ok(new Raw(circuit, command, payload))
        }
      })
    }

  }

  export class Circuitful<T extends Writable.Infer<T>> {
    readonly #raw: Raw<T>

    constructor(
      readonly circuit: SecretCircuit,
      readonly command: number,
      readonly payload: T
    ) {
      this.#raw = new Raw<T>(circuit.id, command, payload)
    }

    static from<T extends Cellable.Circuitful & Writable.Infer<T>>(circuit: SecretCircuit, cellable: T) {
      return new Circuitful(circuit, cellable.command, cellable)
    }

    trySize(): Result<number, Writable.SizeError<T>> {
      return this.#raw.trySize()
    }

    tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
      return this.#raw.tryWrite(cursor)
    }

    tryMap<MapOutput extends Writable.Infer<MapOutput>, MapError>(mapper: (payload: T) => Result<MapOutput, MapError>) {
      return mapper(this.payload).mapSync(payload => new Circuitful(this.circuit, this.command, payload))
    }

  }

  export class Circuitless<T extends Writable.Infer<T>> {
    readonly #raw: Raw<T>

    constructor(
      readonly circuit: undefined,
      readonly command: number,
      readonly payload: T
    ) {
      this.#raw = new Raw<T>(0, command, payload)
    }

    static from<T extends Cellable.Circuitless & Writable.Infer<T>>(circuit: undefined, cellable: T) {
      return new Circuitless(circuit, cellable.command, cellable)
    }

    trySize(): Result<number, Writable.SizeError<T>> {
      return this.#raw.trySize()
    }

    tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
      return this.#raw.tryWrite(cursor)
    }

    tryMap<MapOutput extends Writable.Infer<MapOutput>, MapError>(mapper: (payload: T) => Result<MapOutput, MapError>) {
      return mapper(this.payload).mapSync(payload => new Circuitless(this.circuit, this.command, payload))
    }

  }
}