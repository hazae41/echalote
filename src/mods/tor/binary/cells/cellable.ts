
export interface Cellable {
  readonly circuit: boolean,
  readonly command: number
}

export namespace Cellable {

  export interface Circuitful {
    readonly circuit: true,
    readonly command: number
  }

  export interface Circuitless {
    readonly circuit: false,
    readonly command: number
  }

}