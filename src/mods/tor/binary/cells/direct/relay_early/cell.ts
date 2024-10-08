import { AesWasm } from "@hazae41/aes.wasm";
import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Cell, } from "mods/tor/binary/cells/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";
import { ExpectedCircuitError, ExpectedStreamError, InvalidRelayCommandError, UnexpectedStreamError, UnknownStreamError, UnrecognisedRelayCellError } from "../../errors.js";

export interface RelayEarlyCellable {
  readonly rcommand: number,
  readonly early: true
  readonly stream: boolean
}

export namespace RelayEarlyCellable {

  export interface Streamful {
    readonly rcommand: number,
    readonly early: true
    readonly stream: true
  }

  export interface Streamless {
    readonly rcommand: number,
    readonly early: true
    readonly stream: false
  }

}

export type RelayEarlyCell<T extends Writable> =
  | RelayEarlyCell.Streamful<T>
  | RelayEarlyCell.Streamless<T>

export namespace RelayEarlyCell {

  export const HEAD_LEN = 1 + 2 + 2 + 4 + 2
  export const DATA_LEN = Cell.PAYLOAD_LEN - HEAD_LEN

  export const command = 9

  export class Raw<T extends Writable> {

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: number,
      readonly rcommand: number,
      readonly fragment: T
    ) { }

    unpackOrThrow() {
      if (this.stream === 0)
        return new Streamless(this.circuit, undefined, this.rcommand, this.fragment)

      const stream = this.circuit.streams.get(this.stream)

      if (stream == null)
        throw new UnknownStreamError()

      return new Streamful(this.circuit, stream, this.rcommand, this.fragment)
    }

    cellOrThrow() {
      const cursor = new Cursor(new Uint8Array(Cell.PAYLOAD_LEN))

      cursor.writeUint8OrThrow(this.rcommand)
      cursor.writeUint16OrThrow(0)
      cursor.writeUint16OrThrow(this.stream)

      const digestOffset = cursor.offset

      cursor.writeUint32OrThrow(0)

      const size = this.fragment.sizeOrThrow()
      cursor.writeUint16OrThrow(size)
      this.fragment.writeOrThrow(cursor)

      cursor.fillOrThrow(0, Math.min(cursor.remaining, 4))
      cursor.writeOrThrow(Bytes.random(cursor.remaining))

      const exit = this.circuit.targets[this.circuit.targets.length - 1]

      exit.forward_digest.updateOrThrow(cursor.bytes)

      using digestSlice = exit.forward_digest.finalizeOrThrow()

      cursor.offset = digestOffset
      cursor.writeOrThrow(digestSlice.bytes.subarray(0, 4))

      using memory = new AesWasm.Memory(cursor.bytes)

      for (let i = this.circuit.targets.length - 1; i >= 0; i--)
        this.circuit.targets[i].forward_key.apply_keystream(memory)

      const fragment = new Opaque(new Uint8Array(memory.bytes))

      return new Cell.Circuitful(this.circuit, RelayEarlyCell.command, fragment)
    }

    static uncellOrThrow(cell: Cell<Opaque>) {
      if (cell instanceof Cell.Circuitless)
        throw new ExpectedCircuitError()

      using memory = new AesWasm.Memory(cell.fragment.bytes)

      for (const target of cell.circuit.targets) {
        target.backward_key.apply_keystream(memory)

        const cursor = new Cursor(memory.bytes)

        const rcommand = cursor.readUint8OrThrow()
        const recognised = cursor.readUint16OrThrow()

        if (recognised !== 0)
          continue

        const stream = cursor.readUint16OrThrow()

        const offset = cursor.offset
        const digest4 = cursor.getAndCopyOrThrow(4)

        cursor.writeUint32OrThrow(0)

        using hasher = target.backward_digest.cloneOrThrow()
        using digest = hasher.updateOrThrow(cursor.bytes).finalizeOrThrow()

        if (!Bytes.equals2(digest4, digest.bytes.subarray(0, 4))) {
          cursor.offset = offset
          cursor.writeOrThrow(digest4)
          continue
        }

        target.backward_digest.updateOrThrow(cursor.bytes)

        const length = cursor.readUint16OrThrow()
        const bytes = cursor.readAndCopyOrThrow(length)
        const data = new Opaque(bytes)

        return new Raw<Opaque>(cell.circuit, stream, rcommand, data)
      }

      throw new UnrecognisedRelayCellError()
    }

  }

  export class Streamful<T extends Writable> {
    readonly #raw: Raw<T>

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: SecretTorStreamDuplex,
      readonly rcommand: number,
      readonly fragment: T
    ) {
      this.#raw = new Raw(circuit, stream.id, rcommand, fragment)
    }

    static from<T extends RelayEarlyCellable.Streamful & Writable>(circuit: SecretCircuit, stream: SecretTorStreamDuplex, fragment: T) {
      return new Streamful(circuit, stream, fragment.rcommand, fragment)
    }

    cellOrThrow() {
      return this.#raw.cellOrThrow()
    }

    static intoOrThrow<T extends Writable>(cell: RelayEarlyCell<Opaque>, readable: RelayEarlyCellable.Streamful & Readable<T>) {
      if (cell.rcommand !== readable.rcommand)
        throw new InvalidRelayCommandError()
      if (cell.stream == null)
        throw new ExpectedStreamError()

      const fragment = cell.fragment.readIntoOrThrow(readable)

      return new Streamful(cell.circuit, cell.stream, readable.rcommand, fragment)
    }

  }

  export class Streamless<T extends Writable> {
    readonly #raw: Raw<T>

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: undefined,
      readonly rcommand: number,
      readonly fragment: T
    ) {
      this.#raw = new Raw(circuit, 0, rcommand, fragment)
    }

    static from<T extends RelayEarlyCellable.Streamless & Writable>(circuit: SecretCircuit, stream: undefined, fragment: T) {
      return new Streamless(circuit, stream, fragment.rcommand, fragment)
    }

    cellOrThrow() {
      return this.#raw.cellOrThrow()
    }

    static intoOrThrow<T extends Writable>(cell: RelayEarlyCell<Opaque>, readable: RelayEarlyCellable.Streamless & Readable<T>) {
      if (cell.rcommand !== readable.rcommand)
        throw new InvalidRelayCommandError()
      if (cell.stream != null)
        throw new UnexpectedStreamError()

      const fragment = cell.fragment.readIntoOrThrow(readable)

      return new Streamless(cell.circuit, cell.stream, readable.rcommand, fragment)
    }

  }
}