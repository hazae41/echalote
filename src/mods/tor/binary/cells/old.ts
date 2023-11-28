import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorClientDuplex } from "mods/tor/tor.js";
import { ExpectedCircuitError, InvalidCommandError, UnexpectedCircuitError } from "./errors.js";

export interface OldCellable {
  readonly old: true
  readonly circuit: boolean,
  readonly command: number
}

export namespace OldCellable {

  export interface Circuitful {
    readonly old: true
    readonly circuit: true,
    readonly command: number
  }

  export interface Circuitless {
    readonly old: true
    readonly circuit: false,
    readonly command: number
  }

}

export type OldCell<T extends Writable> =
  | OldCell.Circuitful<T>
  | OldCell.Circuitless<T>

export namespace OldCell {

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
      return this.command === 7
        ? 2 + 1 + 2 + this.fragment.sizeOrThrow()
        : 2 + 1 + PAYLOAD_LEN;
    }

    writeOrThrow(cursor: Cursor) {
      if (this.command === 7) {
        cursor.writeUint16OrThrow(this.circuit)
        cursor.writeUint8OrThrow(this.command)

        const size = this.fragment.sizeOrThrow()
        cursor.writeUint16OrThrow(size)

        this.fragment.writeOrThrow(cursor)

        return
      }

      cursor.writeUint16OrThrow(this.circuit)
      cursor.writeUint8OrThrow(this.command)

      const payload = cursor.readOrThrow(PAYLOAD_LEN)
      const subcursor = new Cursor(payload)

      this.fragment.writeOrThrow(subcursor)

      subcursor.fillOrThrow(0, subcursor.remaining)
    }

    static readOrThrow(cursor: Cursor) {
      const circuit = cursor.readUint16OrThrow()
      const command = cursor.readUint8OrThrow()

      if (command === 7) {
        const length = cursor.readUint16OrThrow()
        const bytes = cursor.readAndCopyOrThrow(length)
        const payload = new Opaque(bytes)

        return new Raw(circuit, command, payload)
      }

      const bytes = cursor.readAndCopyOrThrow(PAYLOAD_LEN)
      const payload = new Opaque(bytes)

      return new Raw(circuit, command, payload)
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

    static from<T extends OldCellable.Circuitful & Writable>(circuit: SecretCircuit, cellable: T) {
      return new Circuitful(circuit, cellable.command, cellable)
    }

    sizeOrThrow() {
      return this.#raw.sizeOrThrow()
    }

    writeOrThrow(cursor: Cursor) {
      this.#raw.writeOrThrow(cursor)
    }

    static intoOrThrow<T extends Writable>(cell: OldCell<Opaque>, readable: OldCellable.Circuitful & Readable<T>) {
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

    static from<T extends OldCellable.Circuitless & Writable>(circuit: undefined, cellable: T) {
      return new Circuitless(circuit, cellable.command, cellable)
    }

    sizeOrThrow() {
      return this.#raw.sizeOrThrow()
    }

    writeOrThrow(cursor: Cursor) {
      this.#raw.writeOrThrow(cursor)
    }

    static intoOrThrow<T extends Writable>(cell: OldCell<Opaque>, readable: OldCellable.Circuitless & Readable<T>) {
      if (cell.command !== readable.command)
        throw new InvalidCommandError()
      if (cell.circuit != null)
        throw new UnexpectedCircuitError()

      const fragment = cell.fragment.readIntoOrThrow(readable)

      return new Circuitless(cell.circuit, readable.command, fragment)
    }

  }
}