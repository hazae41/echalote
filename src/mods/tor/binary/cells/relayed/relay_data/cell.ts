import { Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";

export class RelayDataCell<T extends Writable.Infer<T>> {
  readonly #class = RelayDataCell

  static readonly stream = true
  static readonly rcommand = 2

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: SecretTorStreamDuplex,
    readonly data: T
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.data.trySize()
  }

  tryWrite(cursor: Cursor): Result<void, Writable.WriteError<T>> {
    return this.data.tryWrite(cursor)
  }

}