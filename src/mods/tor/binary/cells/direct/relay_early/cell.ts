import { Arrays } from "@hazae41/arrays";
import { BinaryError, BinaryReadError, BinaryWriteError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { Zepar } from "@hazae41/zepar";
import { Cell, } from "mods/tor/binary/cells/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";
import { ExpectedCircuitError, ExpectedStreamError, InvalidRelayCellDigestError, InvalidRelayCommandError, UnexpectedStreamError, UnknownStreamError, UnrecognisedRelayCellError } from "../../errors.js";

export interface RelayEarlyCellable {
  rcommand: number,
  early: true
  stream: boolean
}

export namespace RelayEarlyCellable {

  export interface Streamful {
    rcommand: number,
    early: true
    stream: true
  }

  export interface Streamless {
    rcommand: number,
    early: true
    stream: false
  }

}

export type RelayEarlyCell<T extends Writable.Infer<T>> =
  | RelayEarlyCell.Streamful<T>
  | RelayEarlyCell.Streamless<T>

export namespace RelayEarlyCell {

  export const HEAD_LEN = 1 + 2 + 2 + 4 + 2
  export const DATA_LEN = Cell.PAYLOAD_LEN - HEAD_LEN

  export const command = 9

  export class Raw<Fragment extends Writable.Infer<Fragment>> {

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: number,
      readonly rcommand: number,
      readonly fragment: Fragment
    ) { }

    tryUnpack(): Result<RelayEarlyCell<Fragment>, UnknownStreamError> {
      if (this.stream === 0)
        return new Ok(new Streamless(this.circuit, undefined, this.rcommand, this.fragment))

      const stream = this.circuit.streams.get(this.stream)

      if (stream == null)
        return new Err(new UnknownStreamError())

      return new Ok(new Streamful(this.circuit, stream, this.rcommand, this.fragment))
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment> | Sha1.AnyError> {
      return Result.unthrowSync(t => {
        const cursor = new Cursor(Bytes.tryAllocUnsafe(Cell.PAYLOAD_LEN).throw(t))

        cursor.tryWriteUint8(this.rcommand).throw(t)
        cursor.tryWriteUint16(0).throw(t)
        cursor.tryWriteUint16(this.stream).throw(t)

        const digestOffset = cursor.offset

        cursor.tryWriteUint32(0).throw(t)

        const size = this.fragment.trySize().throw(t)
        cursor.tryWriteUint16(size).throw(t)
        this.fragment.tryWrite(cursor).throw(t)

        cursor.fill(0, Math.min(cursor.remaining, 4))
        cursor.tryWrite(Bytes.random(cursor.remaining)).throw(t)

        const exit = Arrays.last(this.circuit.targets)!

        exit.forward_digest.tryUpdate(cursor.bytes).throw(t)

        using digestSlice = exit.forward_digest.tryFinalize().throw(t)

        cursor.offset = digestOffset
        cursor.tryWrite(digestSlice.bytes.subarray(0, 4)).throw(t)

        using memory = new Zepar.Memory(cursor.bytes)

        for (let i = this.circuit.targets.length - 1; i >= 0; i--)
          this.circuit.targets[i].forward_key.apply_keystream(memory)

        const fragment = new Opaque(memory.bytes.slice())

        return new Ok(new Cell.Circuitful(this.circuit, RelayEarlyCell.command, fragment))
      })
    }

    static tryUncell(cell: Cell<Opaque>): Result<Raw<Opaque>, BinaryError | ExpectedCircuitError | InvalidRelayCellDigestError | UnrecognisedRelayCellError | Sha1.AnyError> {
      return Result.unthrowSync(t => {
        if (cell instanceof Cell.Circuitless)
          return new Err(new ExpectedCircuitError())

        using memory = new Zepar.Memory(cell.fragment.bytes)

        for (const target of cell.circuit.targets) {
          target.backward_key.apply_keystream(memory)

          const cursor = new Cursor(memory.bytes)

          const rcommand = cursor.tryReadUint8().throw(t)
          const recognised = cursor.tryReadUint16().throw(t)

          if (recognised !== 0)
            continue

          const stream = cursor.tryReadUint16().throw(t)
          const digest = new Uint8Array(cursor.tryGet(4).throw(t))

          cursor.tryWriteUint32(0).throw(t)

          target.backward_digest.tryUpdate(cursor.bytes).throw(t)

          using digestSlice = target.backward_digest.tryFinalize().throw(t)

          if (!Bytes.equals2(digest, digestSlice.bytes.subarray(0, 4)))
            return new Err(new InvalidRelayCellDigestError())

          const length = cursor.tryReadUint16().throw(t)
          const bytes = cursor.tryRead(length).throw(t)
          const data = new Opaque(bytes.slice())

          return new Ok(new Raw<Opaque>(cell.circuit, stream, rcommand, data))
        }

        return new Err(new UnrecognisedRelayCellError())
      })
    }

  }

  export class Streamful<Fragment extends Writable.Infer<Fragment>> {
    readonly #raw: Raw<Fragment>

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: SecretTorStreamDuplex,
      readonly rcommand: number,
      readonly fragment: Fragment
    ) {
      this.#raw = new Raw(circuit, stream.id, rcommand, fragment)
    }

    static from<Fragment extends RelayEarlyCellable.Streamful & Writable.Infer<Fragment>>(circuit: SecretCircuit, stream: SecretTorStreamDuplex, fragment: Fragment) {
      return new Streamful(circuit, stream, fragment.rcommand, fragment)
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment> | Sha1.AnyError> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayEarlyCell<Opaque>, readable: RelayEarlyCellable.Streamful & Readable<ReadOutput, ReadError>): Result<Streamful<ReadOutput>, ReadError | BinaryReadError | InvalidRelayCommandError | ExpectedStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidRelayCommandError())
      if (cell.stream == null)
        return new Err(new ExpectedStreamError())

      return cell.fragment.tryReadInto(readable).mapSync(fragment => new Streamful(cell.circuit, cell.stream, readable.rcommand, fragment))
    }

  }

  export class Streamless<Fragment extends Writable.Infer<Fragment>> {
    readonly #raw: Raw<Fragment>

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: undefined,
      readonly rcommand: number,
      readonly fragment: Fragment
    ) {
      this.#raw = new Raw(circuit, 0, rcommand, fragment)
    }

    static from<Fragment extends RelayEarlyCellable.Streamless & Writable.Infer<Fragment>>(circuit: SecretCircuit, stream: undefined, fragment: Fragment) {
      return new Streamless(circuit, stream, fragment.rcommand, fragment)
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment> | Sha1.AnyError> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayEarlyCell<Opaque>, readable: RelayEarlyCellable.Streamless & Readable<ReadOutput, ReadError>): Result<Streamless<ReadOutput>, ReadError | BinaryReadError | InvalidRelayCommandError | UnexpectedStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidRelayCommandError())
      if (cell.stream != null)
        return new Err(new UnexpectedStreamError())

      return cell.fragment.tryReadInto(readable).mapSync(fragment => new Streamless(cell.circuit, cell.stream, readable.rcommand, fragment))
    }

  }
}