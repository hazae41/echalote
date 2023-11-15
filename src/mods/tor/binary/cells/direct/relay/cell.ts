import { BinaryError, BinaryReadError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { Zepar } from "@hazae41/zepar";
import { Cell, } from "mods/tor/binary/cells/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";
import { ExpectedCircuitError, ExpectedStreamError, InvalidRelayCellDigestError, InvalidRelayCommandError, UnexpectedStreamError, UnknownStreamError, UnrecognisedRelayCellError } from "../../errors.js";
import { RelayDataCell } from "../../relayed/relay_data/cell.js";

export interface RelayCellable {
  readonly rcommand: number,
  readonly early: false,
  readonly stream: boolean
}

export namespace RelayCellable {

  export interface Streamful {
    readonly rcommand: number,
    readonly early: false,
    readonly stream: true
  }

  export interface Streamless {
    readonly rcommand: number,
    readonly early: false,
    readonly stream: false
  }

}

export type RelayCell<T extends Writable> =
  | RelayCell.Streamful<T>
  | RelayCell.Streamless<T>

export namespace RelayCell {

  export const HEAD_LEN = 1 + 2 + 2 + 4 + 2
  export const DATA_LEN = Cell.PAYLOAD_LEN - HEAD_LEN

  export const command = 3

  export class Raw<Fragment extends Writable> {

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: number,
      readonly rcommand: number,
      readonly fragment: Fragment,
      readonly digest20?: Bytes<20>
    ) { }

    unpackOrThrow(): RelayCell<Fragment> {
      if (this.stream === 0)
        return new Streamless(this.circuit, undefined, this.rcommand, this.fragment, this.digest20)

      const stream = this.circuit.streams.get(this.stream)

      if (stream == null)
        throw new UnknownStreamError()

      return new Streamful(this.circuit, stream, this.rcommand, this.fragment, this.digest20)
    }

    cellOrThrow(): Cell.Circuitful<Opaque> {
      const cursor = new Cursor(Bytes.alloc(Cell.PAYLOAD_LEN))

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

      exit.forward_digest.tryUpdate(cursor.bytes).throw(t)

      const digestSlice = exit.forward_digest.tryFinalize().throw(t)
      const digest20 = Bytes.tryCast(digestSlice.copyAndDispose(), 20).throw(t)

      if (this.rcommand === RelayDataCell.rcommand) {
        if (exit.package % 100 === 1)
          exit.digests.push(digest20)
        exit.package--
      }

      cursor.offset = digestOffset
      cursor.tryWrite(digest20.subarray(0, 4)).throw(t)

      using memory = new Zepar.Memory(cursor.bytes)

      for (let i = this.circuit.targets.length - 1; i >= 0; i--)
        this.circuit.targets[i].forward_key.apply_keystream(memory)

      const fragment = new Opaque(memory.bytes.slice())

      return new Ok(new Cell.Circuitful(this.circuit, RelayCell.command, fragment))
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

          const digestSlice = target.backward_digest.tryFinalize().throw(t)
          const digest20 = Bytes.tryCast(digestSlice.copyAndDispose(), 20).throw(t)

          if (!Bytes.equals2(digest, digest20.subarray(0, 4)))
            return new Err(new InvalidRelayCellDigestError())

          const length = cursor.tryReadUint16().throw(t)
          const bytes = cursor.tryRead(length).throw(t)
          const data = new Opaque(bytes.slice())

          return new Ok(new Raw<Opaque>(cell.circuit, stream, rcommand, data, digest20))
        }

        return new Err(new UnrecognisedRelayCellError())
      })
    }

  }

  export class Streamful<Fragment extends Writable> {
    readonly #raw: Raw<Fragment>

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: SecretTorStreamDuplex,
      readonly rcommand: number,
      readonly fragment: Fragment,
      readonly digest20?: Bytes<20>
    ) {
      this.#raw = new Raw(circuit, stream.id, rcommand, fragment)
    }

    static from<Fragment extends RelayCellable.Streamful & Writable>(circuit: SecretCircuit, stream: SecretTorStreamDuplex, fragment: Fragment) {
      return new Streamful(circuit, stream, fragment.rcommand, fragment)
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment> | Sha1.AnyError> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayCell<Opaque>, readable: RelayCellable.Streamful & Readable<ReadOutput, ReadError>): Result<Streamful<ReadOutput>, ReadError | BinaryReadError | InvalidRelayCommandError | ExpectedStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidRelayCommandError())
      if (cell.stream == null)
        return new Err(new ExpectedStreamError())

      return cell.fragment.tryReadInto(readable).mapSync(fragment => new Streamful(cell.circuit, cell.stream, readable.rcommand, fragment, cell.digest20))
    }

  }

  export class Streamless<Fragment extends Writable> {
    readonly #raw: Raw<Fragment>

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: undefined,
      readonly rcommand: number,
      readonly fragment: Fragment,
      readonly digest20?: Bytes<20>
    ) {
      this.#raw = new Raw(circuit, 0, rcommand, fragment)
    }

    static from<Fragment extends RelayCellable.Streamless & Writable.Infer<Fragment>>(circuit: SecretCircuit, stream: undefined, fragment: Fragment) {
      return new Streamless(circuit, stream, fragment.rcommand, fragment)
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment> | Sha1.AnyError> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable, ReadError>(cell: RelayCell<Opaque>, readable: RelayCellable.Streamless & Readable<ReadOutput, ReadError>): Result<Streamless<ReadOutput>, ReadError | BinaryReadError | InvalidRelayCommandError | UnexpectedStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidRelayCommandError())
      if (cell.stream != null)
        return new Err(new UnexpectedStreamError())

      return cell.fragment.tryReadInto(readable).mapSync(fragment => new Streamless(cell.circuit, cell.stream, readable.rcommand, fragment, cell.digest20))
    }

  }
}