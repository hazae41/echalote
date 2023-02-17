import { Cursor } from "@hazae41/binary";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { Tor } from "mods/tor/tor.js";

export type Cell =
  | OldCell
  | NewCell

export interface OldCellRaw {
  type: "old",
  circuitId: number,
  command: number,
  payload: Uint8Array
}

export interface NewCellRaw {
  type: "new",
  circuitId: number,
  command: number,
  payload: Uint8Array
}

export class OldCell {
  readonly #class = OldCell

  constructor(
    readonly circuit: Circuit | undefined,
    readonly command: number,
    readonly payload: Uint8Array
  ) { }

  pack() {
    const binary = Cursor.allocUnsafe(2 + 1 + 2 + this.payload.length)

    binary.writeUint16(this.circuit?.id ?? 0)
    binary.writeUint8(this.command)
    binary.writeUint16(this.payload.length)
    binary.write(this.payload)

    return binary.buffer
  }

  static tryRead(binary: Cursor): OldCellRaw | undefined {
    const start = binary.offset

    try {
      const circuitId = binary.readUint16()
      const command = binary.readUint8()

      const length = command === 7
        ? binary.readUint16()
        : PAYLOAD_LEN
      const payload = binary.read(length)

      return { type: "old", circuitId, command, payload }
    } catch (e: unknown) {
      binary.offset = start
    }
  }

  static unpack(tor: Tor, raw: OldCellRaw) {
    const { circuitId, command, payload } = raw

    const circuit = circuitId
      ? tor.circuits.get(circuitId)
      : undefined

    if (circuitId && !circuit)
      throw new Error(`Unknown circuit id ${circuitId}`)
    return new this(circuit, command, payload)
  }
}

export class NewCell {
  readonly #class = NewCell

  constructor(
    readonly circuit: Circuit | undefined,
    readonly command: number,
    readonly payload: Uint8Array
  ) { }

  pack() {
    if (this.command >= 128) {
      const binary = Cursor.allocUnsafe(4 + 1 + 2 + this.payload.length)

      binary.writeUint32(this.circuit?.id ?? 0)
      binary.writeUint8(this.command)
      binary.writeUint16(this.payload.length)
      binary.write(this.payload)

      return binary.buffer
    } else {
      const binary = Cursor.allocUnsafe(4 + 1 + this.payload.length)

      binary.writeUint32(this.circuit?.id ?? 0)
      binary.writeUint8(this.command)
      binary.write(this.payload)

      return binary.buffer
    }
  }

  static tryRead(binary: Cursor): NewCellRaw | undefined {
    const start = binary.offset

    try {
      const circuitId = binary.readUint32()
      const command = binary.readUint8()

      const length = command >= 128
        ? binary.readUint16()
        : PAYLOAD_LEN

      const payload = binary.read(length)

      return { type: "new", circuitId, command, payload }
    } catch (e: unknown) {
      binary.offset = start
    }
  }

  static unpack(tor: Tor, raw: NewCellRaw) {
    const { circuitId, command, payload } = raw

    const circuit = circuitId
      ? tor.circuits.get(circuitId)
      : undefined

    if (circuitId && !circuit)
      throw new Error(`Unknown circuit id ${circuitId}`)
    return new this(circuit, command, payload)
  }
}