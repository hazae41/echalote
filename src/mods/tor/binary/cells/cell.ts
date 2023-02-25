import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { Tor } from "mods/tor/tor.js";

export interface Cellable extends Writable {
  circuit: Circuit | undefined,
  command: number
}

export class RawOldCell<T extends Writable> {

  constructor(
    readonly circuit: number,
    readonly command: number,
    readonly payload: T
  ) { }

  unpack(tor: Tor) {
    if (!this.circuit)
      return new OldCell(undefined, this.command, this.payload)

    const circuit = tor.circuits.get(this.circuit)

    if (!circuit)
      throw new Error(`Unknown circuit id ${this.circuit}`)

    return new OldCell(circuit, this.command, this.payload)
  }

  size() {
    if (this.command === 7) {
      return 2 + 1 + 2 + this.payload.size()
    } else {
      return 2 + 1 + PAYLOAD_LEN
    }
  }

  write(cursor: Cursor) {
    if (this.command === 7) {
      cursor.writeUint16(this.circuit)
      cursor.writeUint8(this.command)
      cursor.writeUint16(this.payload.size())
      this.payload.write(cursor)
    } else {
      cursor.writeUint16(this.circuit)
      cursor.writeUint8(this.command)

      const payload = cursor.read(PAYLOAD_LEN)
      const subcursor = new Cursor(payload)
      this.payload.write(subcursor)
      subcursor.fill(0, subcursor.remaining)
    }
  }

  static read(cursor: Cursor) {
    const circuit = cursor.readUint16()
    const command = cursor.readUint8()

    if (command === 7) {
      const length = cursor.readUint16()
      const bytes = cursor.read(length)
      const payload = new Opaque(bytes)

      return new this(circuit, command, payload)
    } else {
      const bytes = cursor.read(PAYLOAD_LEN)
      const payload = new Opaque(bytes)

      return new this(circuit, command, payload)
    }
  }

}

export class OldCell<T extends Writable> {

  readonly #raw: RawOldCell<T>

  constructor(
    readonly circuit: Circuit | undefined,
    readonly command: number,
    readonly payload: T
  ) {
    const id = circuit?.id ?? 0

    this.#raw = new RawOldCell<T>(id, command, payload)
  }

  static from<T extends Cellable>(cellable: T) {
    return new this(cellable.circuit, cellable.command, cellable)
  }

  size() {
    return this.#raw.size()
  }

  write(cursor: Cursor) {
    return this.#raw.write(cursor)
  }

}

export class RawCell<T extends Writable> {

  constructor(
    readonly circuit: number,
    readonly command: number,
    readonly payload: T
  ) { }

  unpack(tor: Tor) {
    if (!this.circuit)
      return new Cell(undefined, this.command, this.payload)

    const circuit = tor.circuits.get(this.circuit)

    if (!circuit)
      throw new Error(`Unknown circuit id ${this.circuit}`)

    return new Cell(circuit, this.command, this.payload)
  }

  size() {
    if (this.command >= 128)
      return 4 + 1 + 2 + this.payload.size()
    else
      return 4 + 1 + PAYLOAD_LEN
  }

  write(cursor: Cursor) {
    if (this.command >= 128) {
      cursor.writeUint32(this.circuit)
      cursor.writeUint8(this.command)
      cursor.writeUint16(this.payload.size())
      this.payload.write(cursor)
    } else {
      cursor.writeUint32(this.circuit)
      cursor.writeUint8(this.command)

      const payload = cursor.read(PAYLOAD_LEN)
      const subcursor = new Cursor(payload)
      this.payload.write(subcursor)
      subcursor.fill(0, subcursor.remaining)
    }
  }

  static read(cursor: Cursor) {
    const circuit = cursor.readUint32()
    const command = cursor.readUint8()

    if (command >= 128) {
      const length = cursor.readUint16()
      const bytes = cursor.read(length)
      const payload = new Opaque(bytes)

      return new this<Opaque>(circuit, command, payload)
    } else {
      const bytes = cursor.read(PAYLOAD_LEN)
      const payload = new Opaque(bytes)

      return new this<Opaque>(circuit, command, payload)
    }
  }

}

export class Cell<T extends Writable> {

  readonly #raw: RawCell<T>

  constructor(
    readonly circuit: Circuit | undefined,
    readonly command: number,
    readonly payload: T
  ) {
    const id = circuit?.id ?? 0

    this.#raw = new RawCell<T>(id, command, payload)
  }

  static from<T extends Cellable>(cellable: T) {
    return new this(cellable.circuit, cellable.command, cellable)
  }

  size() {
    return this.#raw.size()
  }

  write(cursor: Cursor) {
    return this.#raw.write(cursor)
  }

}