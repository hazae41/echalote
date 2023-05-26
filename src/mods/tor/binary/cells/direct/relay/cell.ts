import { Arrays } from "@hazae41/arrays";
import { BinaryError, BinaryReadError, BinaryWriteError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { Cell, InvalidCircuitError, InvalidCommandError } from "mods/tor/binary/cells/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";

export interface RelayCellable {
  rcommand: number,
  stream: boolean
}

export namespace RelayCellable {

  export interface Streamful {
    rcommand: number,
    stream: true
  }

  export interface Streamless {
    rcommand: number,
    stream: false
  }

}

export class InvalidStreamError extends Error {
  readonly #class = InvalidStreamError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid stream`)
  }

}

// export class RelayCell<T extends Writable.Infer<T>>  {
//   readonly #class = RelayCell

//   static HEAD_LEN = 1 + 2 + 2 + 4 + 2
//   static DATA_LEN = Cell.PAYLOAD_LEN - this.HEAD_LEN

//   static readonly cell_command = 3

//   constructor(
//     readonly circuit: SecretCircuit,
//     readonly stream: SecretTorStreamDuplex | undefined,
//     readonly rcommand: number,
//     readonly data: T
//   ) { }

//   static from<T extends RelayCellable<T>>(cellable: T) {
//     return new this(cellable.circuit, cellable.stream, cellable.rcommand, cellable)
//   }

//   get command() {
//     return this.#class.command
//   }

//   cell() {
//     const cursor = Cursor.allocUnsafe(Cell.PAYLOAD_LEN)

//     cursor.writeUint8(this.rcommand)
//     cursor.writeUint16(0)
//     cursor.writeUint16(this.stream?.id ?? 0)

//     const digestOffset = cursor.offset

//     cursor.writeUint32(0)

//     cursor.writeUint16(this.data.size())
//     this.data.write(cursor)
//     cursor.fill(0, Math.min(cursor.remaining, 4))
//     cursor.write(Bytes.random(cursor.remaining))

//     const exit = Arrays.last(this.circuit.targets)

//     exit.forward_digest.update(cursor.bytes)

//     const digest = exit.forward_digest.finalize().subarray(0, 4)

//     cursor.offset = digestOffset
//     cursor.write(digest)

//     for (let i = this.circuit.targets.length - 1; i >= 0; i--)
//       this.circuit.targets[i].forward_key.apply_keystream(cursor.bytes)

//     return new Cell(this.circuit, this.command, new Opaque(cursor.bytes))
//   }

//   static uncell(cell: Cell<Opaque>) {
//     if (cell.command !== this.command)
//       throw new InvalidCommand(this.name, cell.command)
//     if (!cell.circuit)
//       throw new InvalidCircuit(this.name, cell.circuit)

//     for (let i = 0; i < cell.circuit.targets.length; i++) {
//       const target = cell.circuit.targets[i]

//       target.backward_key.apply_keystream(cell.payload.bytes)

//       const cursor = new Cursor(cell.payload.bytes)

//       const rcommand = cursor.readUint8()
//       const recognised = cursor.readUint16()

//       if (recognised !== 0)
//         continue

//       const streamId = cursor.readUint16()

//       const stream = streamId
//         ? cell.circuit.streams.get(streamId)
//         : undefined

//       if (streamId && !stream)
//         throw new Error(`Unknown ${this.name} stream id ${streamId}`)

//       const digest = new Uint8Array(cursor.get(4))
//       cursor.writeUint32(0)

//       target.backward_digest.update(cursor.bytes)

//       const digest2 = target.backward_digest.finalize().subarray(0, 4)

//       if (!Bytes.equals(digest, digest2))
//         throw new Error(`Invalid ${this.name} digest`)

//       const length = cursor.readUint16()
//       const bytes = cursor.read(length)
//       const data = new Opaque(bytes)

//       return new this<Opaque>(cell.circuit, stream, rcommand, data)
//     }

//     throw new Error(`Unrecognised ${this.name}`)
//   }
// }

export type RelayCell<T extends Writable.Infer<T>> =
  | RelayCell.Streamful<T>
  | RelayCell.Streamless<T>

export namespace RelayCell {

  export const command = 3

  export class Raw<Fragment extends Writable.Infer<Fragment>> {

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: number,
      readonly rcommand: number,
      readonly fragment: Fragment
    ) { }

    tryUnpack(): Result<RelayCell<Fragment>, InvalidStreamError> {
      if (this.stream === 0)
        return new Ok(new Streamless(this.circuit, undefined, this.rcommand, this.fragment))

      const stream = this.circuit.streams.get(this.stream)

      if (stream === undefined)
        return new Err(new InvalidStreamError())

      return new Ok(new Streamful(this.circuit, stream, this.rcommand, this.fragment))
    }

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return Result.unthrowSync(t => {
        const cursor = Cursor.allocUnsafe(Cell.PAYLOAD_LEN)

        cursor.tryWriteUint8(this.rcommand).throw(t)
        cursor.tryWriteUint16(0).throw(t)
        cursor.tryWriteUint16(this.stream)

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

    static tryUncell(cell: Cell<Opaque>): Result<Raw<Opaque>, BinaryError | InvalidCircuitError> {
      return Result.unthrowSync(t => {
        if (cell instanceof Cell.Circuitless)
          return new Err(new InvalidCircuitError())

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
            throw new Error(`Invalid digest`)

          const length = cursor.tryReadUint16().throw(t)
          const bytes = cursor.tryRead(length).throw(t)
          const data = new Opaque(bytes)

          return new Ok(new Raw<Opaque>(cell.circuit, stream, rcommand, data))
        }

        throw new Error(`Unrecognised relay cell`)
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

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayCell<Opaque>, readable: RelayCellable.Streamful & Readable<ReadOutput, ReadError>): Result<Streamful<ReadOutput>, ReadError | BinaryReadError | InvalidCommandError | InvalidStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidCommandError())
      if (cell.stream === undefined)
        return new Err(new InvalidStreamError())

      return cell.fragment.tryInto(readable).mapSync(fragment => new Streamful(cell.circuit, cell.stream, readable.rcommand, fragment))
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

    tryCell(): Result<Cell.Circuitful<Opaque>, BinaryWriteError | Writable.SizeError<Fragment> | Writable.WriteError<Fragment>> {
      return this.#raw.tryCell()
    }

    static tryInto<ReadOutput extends Writable.Infer<ReadOutput>, ReadError>(cell: RelayCell<Opaque>, readable: RelayCellable.Streamless & Readable<ReadOutput, ReadError>): Result<Streamless<ReadOutput>, ReadError | BinaryReadError | InvalidCommandError | InvalidStreamError> {
      if (cell.rcommand !== readable.rcommand)
        return new Err(new InvalidCommandError())
      if (cell.stream !== undefined)
        return new Err(new InvalidStreamError())

      return cell.fragment.tryInto(readable).mapSync(fragment => new Streamless(cell.circuit, cell.stream, readable.rcommand, fragment))
    }

  }
}