export class Kcp2Stream {

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) { }

}