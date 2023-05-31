import { Arrays } from "@hazae41/arrays";
import { BinaryError, BinaryReadError, BinaryWriteError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { Cell, } from "mods/tor/binary/cells/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";
import { ExpectedCircuitError, ExpectedStreamError, InvalidRelayCellDigestError, InvalidRelayCommandError, UnexpectedStreamError, UnknownStreamError, UnrecognisedRelayCellError } from "../../errors.js";

export interface RelayCellable {
  rcommand: number,
  early: false,
  stream: boolean
}

export namespace RelayCellable {

  export interface Streamful {
    rcommand: number,
    early: false,
    stream: true
  }

  export interface Streamless {
    rcommand: number,
    early: false,
    stream: false
  }

}

export type RelayCell<T extends Writable.Infer<T>> =
  | RelayCell.Streamful<T>
  | RelayCell.Streamless<T>

export namespace RelayCell {

  export const HEAD_LEN = 1 + 2 + 2 + 4 + 2
  export const DATA_LEN = Cell.PAYLOAD_LEN - HEAD_LEN

  export const command = 3

  export class Raw<Fragment extends Writable.Infer<Fragment>> {

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: number,
      readonly rcommand: number,
      readonly fragment: Fragment
    ) { }

    tryUnpack(): Result<RelayCell<Fragment>, UnknownStreamError> {
      if (this.stream === 0)
        return new Ok(new Streamless(this.circuit, undefined, this.rcommand, this.fragment))

      const stream = this.circuit.streams.get(this.stream)

      if (stream === undefined)
        return new Err(new UnknownStreamError())

      return new Ok(new Streamful(this.circuit, stream, this.rcommand, this.fragment))
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return Result.unthrowSync(t => {
        const cursor = Cursor.allocUnsafe(Cell.PAYLOAD_LEN)

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

        const exit = Arrays.last(this.circuit.targets)

        exit.forward_digest.update(cursor.bytes)

        const digest = exit.forward_digest.finalize().subarray(0, 4)

        cursor.offset = digestOffset
        cursor.tryWrite(digest).throw(t)

        for (let i = this.circuit.targets.length - 1; i >= 0; i--)
          this.circuit.targets[i].forward_key.apply_keystream(cursor.bytes)

        return new Ok(new Cell.Circuitful(this.circuit, RelayCell.command, new Opaque(cursor.bytes)))
      })
    }

    static tryUncell(cell: Cell<Opaque>): Result<Raw<Opaque>, BinaryError | ExpectedCircuitError | InvalidRelayCellDigestError | UnrecognisedRelayCellError> {
      return Result.unthrowSync(t => {
        if (cell instanceof Cell.Circuitless)
          return new Err(new ExpectedCircuitError())

        for (const target of cell.circuit.targets) {
          target.backward_key.apply_keystream(cell.fragment.bytes)

          const cursor = new Cursor(cell.fragment.bytes)

          const rcommand = cursor.tryReadUint8().throw(t)
          const recognised = cursor.tryReadUint16().throw(t)

          if (recognised !== 0)
            continue

          const stream = cursor.tryReadUint16().throw(t)
          const digest = Bytes.from(cursor.tryGet(4).throw(t))

          cursor.tryWriteUint32(0).throw(t)

          target.backward_digest.update(cursor.bytes)

          const digest2 = target.backward_digest.finalize().subarray(0, 4)

          if (!Bytes.equals2(digest, digest2))
            return new Err(new InvalidRelayCellDigestError())

          const length = cursor.tryReadUint16().throw(t)
          const bytes = cursor.tryRead(length).throw(t)
          const data = new Opaque(bytes)

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

    static from<Fragment extends RelayCellable.Streamful & Writable.Infer<Fragment>>(circuit: SecretCircuit, stream: SecretTorStreamDuplex, fragment: Fragment) {
      return new Streamful(circuit, stream, fragment.rcommand, fragment)
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayCell<Opaque>, readable: RelayCellable.Streamful & Readable<ReadOutput, ReadError>): Result<Streamful<ReadOutput>, ReadError | BinaryReadError | InvalidRelayCommandError | ExpectedStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidRelayCommandError())
      if (cell.stream === undefined)
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

    static from<Fragment extends RelayCellable.Streamless & Writable.Infer<Fragment>>(circuit: SecretCircuit, stream: undefined, fragment: Fragment) {
      return new Streamless(circuit, stream, fragment.rcommand, fragment)
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayCell<Opaque>, readable: RelayCellable.Streamless & Readable<ReadOutput, ReadError>): Result<Streamless<ReadOutput>, ReadError | BinaryReadError | InvalidRelayCommandError | UnexpectedStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidRelayCommandError())
      if (cell.stream !== undefined)
        return new Err(new UnexpectedStreamError())

      return cell.fragment.tryReadInto(readable).mapSync(fragment => new Streamless(cell.circuit, cell.stream, readable.rcommand, fragment))
    }

  }
}