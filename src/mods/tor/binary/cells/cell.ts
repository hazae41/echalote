import { BinaryError, BinaryReadError, Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorClientDuplex } from "mods/tor/tor.js";

export interface Cellable<T extends Writable> extends Writable.Infer<T> {
  circuit: SecretCircuit | undefined,
  command: number
}

export class RawOldCell<T extends Writable.Infer<T>> {

  constructor(
    readonly circuit: number,
    readonly command: number,
    readonly payload: T
  ) { }

  tryUnpack(tor: SecretTorClientDuplex) {
    if (!this.circuit)
      return new OldCell(undefined, this.command, this.payload)

    const circuit = tor.circuits.inner.get(this.circuit)

    if (!circuit)
      throw new Error(`Unknown circuit id ${this.circuit}`)

    return new OldCell(circuit, this.command, this.payload)
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    if (this.command === 7)
      return this.payload.trySize().mapSync(x => 2 + 1 + 2 + x)
    else
      return new Ok(2 + 1 + Cell.PAYLOAD_LEN)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      if (this.command === 7) {
        cursor.tryWriteUint16(this.circuit).throw(t)
        cursor.tryWriteUint8(this.command).throw(t)

        const size = this.payload.trySize().throw(t)
        cursor.tryWriteUint16(size).throw(t)

        this.payload.tryWrite(cursor).throw(t)

        return Ok.void()
      } else {
        cursor.tryWriteUint16(this.circuit).throw(t)
        cursor.tryWriteUint8(this.command).throw(t)

        const payload = cursor.tryRead(Cell.PAYLOAD_LEN).throw(t)
        const subcursor = new Cursor(payload)
        this.payload.tryWrite(subcursor).throw(t)
        subcursor.fill(0, subcursor.remaining)

        return Ok.void()
      }
    })
  }

  static tryRead(cursor: Cursor): Result<RawOldCell<Opaque>, BinaryReadError> {
    return Result.unthrowSync(t => {
      const circuit = cursor.tryReadUint16().throw(t)
      const command = cursor.tryReadUint8().throw(t)

      if (command === 7) {
        const length = cursor.tryReadUint16().throw(t)
        const bytes = cursor.tryRead(length).throw(t)
        const payload = new Opaque(bytes)

        return new Ok(new RawOldCell(circuit, command, payload))
      } else {
        const bytes = cursor.tryRead(Cell.PAYLOAD_LEN).throw(t)
        const payload = new Opaque(bytes)

        return new Ok(new RawOldCell(circuit, command, payload))
      }
    })
  }

}

export class OldCell<T extends Writable.Infer<T>> {

  readonly #raw: RawOldCell<T>

  constructor(
    readonly circuit: SecretCircuit | undefined,
    readonly command: number,
    readonly payload: T
  ) {
    const id = circuit?.id ?? 0

    this.#raw = new RawOldCell<T>(id, command, payload)
  }

  static from<T extends Cellable<T>>(cellable: T) {
    return new OldCell(cellable.circuit, cellable.command, cellable)
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.#raw.trySize()
  }

  tryWrite(cursor: Cursor): Result<void, Writable.SizeError<T> | Writable.WriteError<T> | BinaryError> {
    return this.#raw.tryWrite(cursor)
  }

}

export class RawCell<T extends Writable.Infer<T>> {

  constructor(
    readonly circuit: number,
    readonly command: number,
    readonly payload: T
  ) { }

  unpack(tor: SecretTorClientDuplex) {
    if (!this.circuit)
      return new Cell(undefined, this.command, this.payload)

    const circuit = tor.circuits.inner.get(this.circuit)

    if (!circuit)
      throw new Error(`Unknown circuit id ${this.circuit}`)

    return new Cell(circuit, this.command, this.payload)
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    if (this.command >= 128)
      return this.payload.trySize().mapSync(x => 4 + 1 + 2 + x)
    else
      return new Ok(4 + 1 + Cell.PAYLOAD_LEN)
  }

  tryWrite(cursor: Cursor): Result<void, Writable.SizeError<T> | Writable.WriteError<T> | BinaryError> {
    return Result.unthrowSync(t => {
      if (this.command >= 128) {
        cursor.tryWriteUint32(this.circuit).throw(t)
        cursor.tryWriteUint8(this.command).throw(t)

        const size = this.payload.trySize().throw(t)
        cursor.tryWriteUint16(size).throw(t)

        this.payload.tryWrite(cursor).throw(t)

        return Ok.void()
      } else {
        cursor.tryWriteUint32(this.circuit).throw(t)
        cursor.tryWriteUint8(this.command).throw(t)

        const payload = cursor.tryRead(Cell.PAYLOAD_LEN).throw(t)
        const subcursor = new Cursor(payload)
        this.payload.tryWrite(subcursor).throw(t)
        subcursor.fill(0, subcursor.remaining)

        return Ok.void()
      }
    })
  }

  static tryRead(cursor: Cursor): Result<RawCell<Opaque>, BinaryReadError> {
    return Result.unthrowSync(t => {
      const circuit = cursor.tryReadUint32().throw(t)
      const command = cursor.tryReadUint8().throw(t)

      if (command >= 128) {
        const length = cursor.tryReadUint16().throw(t)
        const bytes = cursor.tryRead(length).throw(t)
        const payload = new Opaque(bytes)

        return new Ok(new RawCell<Opaque>(circuit, command, payload))
      } else {
        const bytes = cursor.tryRead(Cell.PAYLOAD_LEN).throw(t)
        const payload = new Opaque(bytes)

        return new Ok(new RawCell<Opaque>(circuit, command, payload))
      }
    })
  }

}

export class Cell<T extends Writable.Infer<T>> {
  readonly #raw: RawCell<T>

  constructor(
    readonly circuit: SecretCircuit | undefined,
    readonly command: number,
    readonly payload: T
  ) {
    const id = circuit?.id ?? 0

    this.#raw = new RawCell<T>(id, command, payload)
  }

  static from<T extends Cellable<T>>(cellable: T) {
    return new this(cellable.circuit, cellable.command, cellable)
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.#raw.trySize()
  }

  tryWrite(cursor: Cursor): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return this.#raw.tryWrite(cursor)
  }

}

export namespace Cell {
  export type PAYLOAD_LEN = 509
  export const PAYLOAD_LEN = 509
}