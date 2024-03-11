import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorClientDuplex } from "mods/tor/client.js";
import { ExpectedCircuitError, InvalidCommandError, UnexpectedCircuitError } from "./errors.js";

export interface Cellable {
  readonly old: false
  readonly circuit: boolean,
  readonly command: number
}

export namespace Cellable {

  export interface Circuitful {
    readonly old: false
    readonly circuit: true,
    readonly command: number
  }

  export interface Circuitless {
    readonly old: false
    readonly circuit: false,
    readonly command: number
  }

}

export type Cell<T extends Writable> =
  | Cell.Circuitful<T>
  | Cell.Circuitless<T>

export namespace Cell {

  export type PAYLOAD_LEN = 509
  export const PAYLOAD_LEN = 509

  export class Raw<T extends Writable> {

    constructor(
      readonly circuit: number,
      readonly command: number,
      readonly fragment: T
    ) { }

    unpackOrNull(tor: SecretTorClientDuplex) {
      if (this.circuit === 0)
        return new Circuitless(undefined, this.command, this.fragment)

      const circuit = tor.circuits.inner.get(this.circuit)

      if (circuit == null)
        return undefined

      return new Circuitful(circuit, this.command, this.fragment)
    }

    sizeOrThrow() {
      return this.command >= 128
        ? 4 + 1 + 2 + this.fragment.sizeOrThrow()
        : 4 + 1 + PAYLOAD_LEN
    }

    writeOrThrow(cursor: Cursor) {
      if (this.command >= 128) {
        cursor.writeUint32OrThrow(this.circuit)
        cursor.writeUint8OrThrow(this.command)

        const size = this.fragment.sizeOrThrow()
        cursor.writeUint16OrThrow(size)

        this.fragment.writeOrThrow(cursor)

        return
      }

      cursor.writeUint32OrThrow(this.circuit)
      cursor.writeUint8OrThrow(this.command)

      const payload = cursor.readOrThrow(PAYLOAD_LEN)
      const subcursor = new Cursor(payload)

      this.fragment.writeOrThrow(subcursor)

      subcursor.fillOrThrow(0, subcursor.remaining)
    }

    static readOrThrow(cursor: Cursor) {
      const circuit = cursor.readUint32OrThrow()
      const command = cursor.readUint8OrThrow()

      if (command >= 128) {
        const length = cursor.readUint16OrThrow()
        const bytes = cursor.readAndCopyOrThrow(length)
        const payload = new Opaque(bytes)

        return new Raw<Opaque>(circuit, command, payload)
      }

      const bytes = cursor.readAndCopyOrThrow(PAYLOAD_LEN)
      const payload = new Opaque(bytes)

      return new Raw<Opaque>(circuit, command, payload)
    }

  }

  export class Circuitful<T extends Writable> {
    readonly #raw: Raw<T>

    constructor(
      readonly circuit: SecretCircuit,
      readonly command: number,
      readonly fragment: T
    ) {
      this.#raw = new Raw<T>(circuit.id, command, fragment)
    }

    static from<T extends Cellable.Circuitful & Writable>(circuit: SecretCircuit, cellable: T) {
      return new Circuitful(circuit, cellable.command, cellable)
    }

    sizeOrThrow() {
      return this.#raw.sizeOrThrow()
    }

    writeOrThrow(cursor: Cursor) {
      this.#raw.writeOrThrow(cursor)
    }

    static intoOrThrow<T extends Writable>(cell: Cell<Opaque>, readable: Cellable.Circuitful & Readable<T>) {
      if (cell.command !== readable.command)
        throw new InvalidCommandError()
      if (cell.circuit == null)
        throw new ExpectedCircuitError()

      const fragment = cell.fragment.readIntoOrThrow(readable)

      return new Circuitful(cell.circuit, readable.command, fragment)
    }

  }

  export class Circuitless<T extends Writable> {
    readonly #raw: Raw<T>

    constructor(
      readonly circuit: undefined,
      readonly command: number,
      readonly fragment: T
    ) {
      this.#raw = new Raw<T>(0, command, fragment)
    }

    static from<T extends Cellable.Circuitless & Writable>(circuit: undefined, cellable: T) {
      return new Circuitless(circuit, cellable.command, cellable)
    }

    sizeOrThrow() {
      return this.#raw.sizeOrThrow()
    }

    writeOrThrow(cursor: Cursor) {
      this.#raw.writeOrThrow(cursor)
    }

    static intoOrThrow<T extends Writable>(cell: Cell<Opaque>, readable: Cellable.Circuitless & Readable<T>) {
      if (cell.command !== readable.command)
        throw new InvalidCommandError()
      if (cell.circuit != null)
        throw new UnexpectedCircuitError()

      const fragment = cell.fragment.readIntoOrThrow(readable)

      return new Circuitless(cell.circuit, readable.command, fragment)
    }

  }

}