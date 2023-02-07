export class SmuxStream {

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) { }

}