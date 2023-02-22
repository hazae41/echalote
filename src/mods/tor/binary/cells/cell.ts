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
    const cursor = Cursor.allocUnsafe(2 + 1 + 2 + this.payload.length)

    cursor.writeUint16(this.circuit?.id ?? 0)
    cursor.writeUint8(this.command)
    cursor.writeUint16(this.payload.length)
    cursor.write(this.payload)

    return cursor.bytes
  }

  static tryRead(cursor: Cursor): OldCellRaw | undefined {
    const start = cursor.offset

    try {
      const circuitId = cursor.readUint16()
      const command = cursor.readUint8()

      const length = command === 7
        ? cursor.readUint16()
        : PAYLOAD_LEN
      const payload = cursor.read(length)

      return { type: "old", circuitId, command, payload }
    } catch (e: unknown) {
      cursor.offset = start
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
      const cursor = Cursor.allocUnsafe(4 + 1 + 2 + this.payload.length)

      cursor.writeUint32(this.circuit?.id ?? 0)
      cursor.writeUint8(this.command)
      cursor.writeUint16(this.payload.length)
      cursor.write(this.payload)

      return cursor.bytes
    } else {
      const cursor = Cursor.allocUnsafe(4 + 1 + this.payload.length)

      cursor.writeUint32(this.circuit?.id ?? 0)
      cursor.writeUint8(this.command)
      cursor.write(this.payload)

      return cursor.bytes
    }
  }

  static tryRead(cursor: Cursor): NewCellRaw | undefined {
    const start = cursor.offset

    try {
      const circuitId = cursor.readUint32()
      const command = cursor.readUint8()

      const length = command >= 128
        ? cursor.readUint16()
        : PAYLOAD_LEN

      const payload = cursor.read(length)

      return { type: "new", circuitId, command, payload }
    } catch (e: unknown) {
      cursor.offset = start
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