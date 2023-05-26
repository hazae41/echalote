import { BinaryError, BinaryReadError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorClientDuplex } from "mods/tor/tor.js";
import { Cellable } from "./cellable.js";

export class InvalidCommandError extends Error {
  readonly #class = InvalidCommandError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid command`)
  }

}

export class InvalidCircuitError extends Error {
  readonly #class = InvalidCircuitError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid circuit`)
  }

}

export type Cell<T extends Writable.Infer<T>> =
  | Cell.Circuitful<T>
  | Cell.Circuitless<T>

export namespace Cell {

  export type PAYLOAD_LEN = 509
  export const PAYLOAD_LEN = 509

  export function tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: Cell<Opaque>, readable: Cellable & Readable<ReadOutput, ReadError>): Result<Cell<ReadOutput>, ReadError | BinaryReadError | InvalidCommandError | InvalidCircuitError> {
    if (readable.command !== cell.command)
      return new Err(new InvalidCommandError())
    if (readable.circuit !== Boolean(cell.circuit))
      return new Err(new InvalidCircuitError())

    return cell.tryMap(payload => payload.tryInto(readable))
  }

  export class Raw<Fragment extends Writable.Infer<Fragment>> {

    constructor(
      readonly circuit: number,
      readonly command: number,
      readonly fragment: Fragment
    ) { }

    tryUnpack(tor: SecretTorClientDuplex) {
      if (this.circuit === 0)
        return new Ok(new Circuitless(undefined, this.command, this.fragment))

      const circuit = tor.circuits.inner.get(this.circuit)

      if (circuit === undefined)
        throw new Error(`Unknown circuit id ${this.circuit}`)

      return new Ok(new Circuitful(circuit, this.command, this.fragment))
    }

    trySize(): Result<number, Writable.SizeError<Fragment>> {
      if (this.command >= 128)
        return this.fragment.trySize().mapSync(x => 4 + 1 + 2 + x)
      else
        return new Ok(4 + 1 + PAYLOAD_LEN)
    }

    tryWrite(cursor: Cursor): Result<void, Writable.SizeError<Fragment> | Writable.WriteError<Fragment> | BinaryError> {
      return Result.unthrowSync(t => {
        if (this.command >= 128) {
          cursor.tryWriteUint32(this.circuit).throw(t)
          cursor.tryWriteUint8(this.command).throw(t)

          const size = this.fragment.trySize().throw(t)
          cursor.tryWriteUint16(size).throw(t)

          this.fragment.tryWrite(cursor).throw(t)

          return Ok.void()
        } else {
          cursor.tryWriteUint32(this.circuit).throw(t)
          cursor.tryWriteUint8(this.command).throw(t)

          const payload = cursor.tryRead(PAYLOAD_LEN).throw(t)
          const subcursor = new Cursor(payload)
          this.fragment.tryWrite(subcursor).throw(t)
          subcursor.fill(0, subcursor.remaining)

          return Ok.void()
        }
      })
    }

    static tryRead(cursor: Cursor): Result<Raw<Opaque>, BinaryReadError> {
      return Result.unthrowSync(t => {
        const circuit = cursor.tryReadUint32().throw(t)
        const command = cursor.tryReadUint8().throw(t)

        if (command >= 128) {
          const length = cursor.tryReadUint16().throw(t)
          const bytes = cursor.tryRead(length).throw(t)
          const payload = new Opaque(bytes)

          return new Ok(new Raw<Opaque>(circuit, command, payload))
        } else {
          const bytes = cursor.tryRead(PAYLOAD_LEN).throw(t)
          const payload = new Opaque(bytes)

          return new Ok(new Raw<Opaque>(circuit, command, payload))
        }
      })
    }

  }

  export class Circuitful<Fragment extends Writable.Infer<Fragment>> {
    readonly #raw: Raw<Fragment>

    constructor(
      readonly circuit: SecretCircuit,
      readonly command: number,
      readonly fragment: Fragment
    ) {
      this.#raw = new Raw<Fragment>(circuit.id, command, fragment)
    }

    static from<T extends Cellable.Circuitful & Writable.Infer<T>>(circuit: SecretCircuit, cellable: T) {
      return new Circuitful(circuit, cellable.command, cellable)
    }

    trySize(): Result<number, Writable.SizeError<Fragment>> {
      return this.#raw.trySize()
    }

    tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return this.#raw.tryWrite(cursor)
    }

    tryMap<MapOutput extends Writable.Infer<MapOutput>, MapError>(mapper: (payload: Fragment) => Result<MapOutput, MapError>) {
      return mapper(this.fragment).mapSync(payload => new Circuitful(this.circuit, this.command, payload))
    }

  }

  export class Circuitless<Fragment extends Writable.Infer<Fragment>> {
    readonly #raw: Raw<Fragment>

    constructor(
      readonly circuit: undefined,
      readonly command: number,
      readonly fragment: Fragment
    ) {
      this.#raw = new Raw<Fragment>(0, command, fragment)
    }

    static from<T extends Cellable.Circuitless & Writable.Infer<T>>(circuit: undefined, cellable: T) {
      return new Circuitless(circuit, cellable.command, cellable)
    }

    trySize(): Result<number, Writable.SizeError<Fragment>> {
      return this.#raw.trySize()
    }

    tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return this.#raw.tryWrite(cursor)
    }

    tryMap<MapOutput extends Writable.Infer<MapOutput>, MapError>(mapper: (payload: Fragment) => Result<MapOutput, MapError>) {
      return mapper(this.fragment).mapSync(payload => new Circuitless(this.circuit, this.command, payload))
    }

  }

}