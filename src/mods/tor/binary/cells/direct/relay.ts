import { lastOf } from "libs/array.js";
import { Binary } from "libs/binary.js";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayCell {
  readonly class = RelayCell

  static command = 3

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream | undefined,
    readonly rcommand: number,
    readonly data: Buffer
  ) { }

  async pack() {
    return (await this.cell()).pack()
  }

  async cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.rcommand)
    binary.writeUint16(0)
    binary.writeUint16(this.stream?.id ?? 0)

    const digestOffset = binary.offset
    binary.writeUint32(0)

    binary.writeUint16(this.data.length)
    binary.write(this.data)
    binary.fill(Math.min(binary.remaining, 4))

    if (binary.remaining > 0) {
      const random = Buffer.allocUnsafe(binary.remaining)
      binary.write(crypto.getRandomValues(random))
    }

    const exit = lastOf(this.circuit.targets)

    exit.forwardDigest.update(binary.buffer)

    const fullDigest = Buffer.from(exit.forwardDigest.finalize().buffer)
    const digest = fullDigest.subarray(0, 4)

    binary.offset = digestOffset
    binary.write(digest)


    for (let i = this.circuit.targets.length - 1; i >= 0; i--)
      this.circuit.targets[i].forwardKey.apply_keystream(binary.buffer)

    return new NewCell(this.circuit, this.class.command, binary.buffer)
  }

  static async uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new Error(`Invalid RELAY cell command ${cell.command}`)
    if (!cell.circuit)
      throw new Error(`Can't uncell a RELAY cell on circuit 0`)

    for (let i = 0; i < cell.circuit.targets.length; i++)
      cell.circuit.targets[i].backwardKey.apply_keystream(cell.payload)

    const binary = new Binary(cell.payload)

    const rcommand = binary.readUint8()
    const recognised = binary.readUint16()

    if (recognised !== 0)
      throw new Error(`Unrecognised RELAY cell`)

    const streamId = binary.readUint16()

    const stream = streamId
      ? cell.circuit.streams.get(streamId)
      : undefined

    if (streamId && !stream)
      throw new Error(`Unknown stream id ${streamId}`)

    const digest = binary.read(4) // TODO 
    const length = binary.readUint16()
    const data = binary.read(length)

    return new this(cell.circuit, stream, rcommand, data)
  }
}