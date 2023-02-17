import { Cursor } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Arrays } from "libs/arrays/arrays.js";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayCell {
  readonly #class = RelayCell

  static command = 3

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream | undefined,
    readonly rcommand: number,
    readonly data: Uint8Array
  ) { }

  protected get class() {
    return this.#class
  }

  async pack() {
    return (await this.cell()).pack()
  }

  async cell() {
    const binary = Cursor.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.rcommand)
    binary.writeUint16(0)
    binary.writeUint16(this.stream?.id ?? 0)

    const digestOffset = binary.offset

    binary.writeUint32(0)

    binary.writeUint16(this.data.length)
    binary.write(this.data)
    binary.fill(Math.min(binary.remaining, 4))

    if (binary.remaining > 0)
      binary.write(Bytes.random(binary.remaining))

    const exit = Arrays.lastOf(this.circuit.targets)

    exit.forwardDigest.update(binary.buffer)

    const digest = exit.forwardDigest.finalize().subarray(0, 4)

    binary.offset = digestOffset
    binary.write(digest)

    for (let i = this.circuit.targets.length - 1; i >= 0; i--)
      this.circuit.targets[i].forwardKey.apply_keystream(binary.buffer)

    return new NewCell(this.circuit, this.class.command, binary.buffer)
  }

  static async uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    for (let i = 0; i < cell.circuit.targets.length; i++) {
      const target = cell.circuit.targets[i]

      target.backwardKey.apply_keystream(cell.payload)

      const binary = new Cursor(cell.payload)

      const rcommand = binary.readUint8()
      const recognised = binary.readUint16()

      if (recognised !== 0)
        continue

      const streamId = binary.readUint16()

      const stream = streamId
        ? cell.circuit.streams.get(streamId)
        : undefined

      if (streamId && !stream)
        throw new Error(`Unknown ${this.name} stream id ${streamId}`)

      const digest = new Uint8Array(binary.get(4))
      binary.writeUint32(0)

      target.backwardDigest.update(binary.buffer)

      const digest2 = target.backwardDigest.finalize().subarray(0, 4)

      if (!Bytes.equals(digest, digest2))
        throw new Error(`Invalid ${this.name} digest`)

      const length = binary.readUint16()
      const data = binary.read(length)

      return new this(cell.circuit, stream, rcommand, data)
    }

    throw new Error(`Unrecognised ${this.name}`)
  }
}