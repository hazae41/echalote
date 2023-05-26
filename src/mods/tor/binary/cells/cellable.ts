import { Writable } from "@hazae41/binary"

export interface Cellable<T extends Writable.Infer<T>> extends Writable.Infer<T> {
  readonly circuit: boolean,
  readonly command: number
}

export namespace Cellable {

  export interface Circuitful<T extends Writable.Infer<T>> extends Writable.Infer<T> {
    readonly circuit: true,
    readonly command: number
  }

  export interface Circuitless<T extends Writable.Infer<T>> extends Writable.Infer<T> {
    readonly circuit: false,
    readonly command: number
  }

}