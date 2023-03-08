import { Arrays } from "@hazae41/arrays";
import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";

export interface RelayCellable extends Writable {
  rcommand: number,
  circuit: SecretCircuit,
  stream?: SecretTorStreamDuplex
}

export class RelayCell<T extends Writable>  {
  readonly #class = RelayCell

  static HEAD_LEN = 1 + 2 + 2 + 4 + 2
  static DATA_LEN = Cell.PAYLOAD_LEN - this.HEAD_LEN

  static command = 3

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: SecretTorStreamDuplex | undefined,
    readonly rcommand: number,
    readonly data: T
  ) { }

  static from<T extends RelayCellable>(cellable: T) {
    return new this(cellable.circuit, cellable.stream, cellable.rcommand, cellable)
  }

  get command() {
    return this.#class.command
  }

  cell() {
    const cursor = Cursor.allocUnsafe(Cell.PAYLOAD_LEN)

    cursor.writeUint8(this.rcommand)
    cursor.writeUint16(0)
    cursor.writeUint16(this.stream?.id ?? 0)

    const digestOffset = cursor.offset

    cursor.writeUint32(0)

    cursor.writeUint16(this.data.size())
    this.data.write(cursor)
    cursor.fill(0, Math.min(cursor.remaining, 4))
    cursor.write(Bytes.random(cursor.remaining))

    const exit = Arrays.last(this.circuit.targets)

    exit.forward_digest.update(cursor.bytes)

    const digest = exit.forward_digest.finalize().subarray(0, 4)

    cursor.offset = digestOffset
    cursor.write(digest)

    for (let i = this.circuit.targets.length - 1; i >= 0; i--)
      this.circuit.targets[i].forward_key.apply_keystream(cursor.bytes)

    return new Cell(this.circuit, this.command, new Opaque(cursor.bytes))
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    for (let i = 0; i < cell.circuit.targets.length; i++) {
      const target = cell.circuit.targets[i]

      target.backward_key.apply_keystream(cell.payload.bytes)

      const cursor = new Cursor(cell.payload.bytes)

      const rcommand = cursor.readUint8()
      const recognised = cursor.readUint16()

      if (recognised !== 0)
        continue

      const streamId = cursor.readUint16()

      const stream = streamId
        ? cell.circuit.streams.get(streamId)
        : undefined

      if (streamId && !stream)
        throw new Error(`Unknown ${this.name} stream id ${streamId}`)

      const digest = new Uint8Array(cursor.get(4))
      cursor.writeUint32(0)

      target.backward_digest.update(cursor.bytes)

      const digest2 = target.backward_digest.finalize().subarray(0, 4)

      if (!Bytes.equals(digest, digest2))
        throw new Error(`Invalid ${this.name} digest`)

      const length = cursor.readUint16()
      const bytes = cursor.read(length)
      const data = new Opaque(bytes)

      return new this<Opaque>(cell.circuit, stream, rcommand, data)
    }

    throw new Error(`Unrecognised ${this.name}`)
  }
}