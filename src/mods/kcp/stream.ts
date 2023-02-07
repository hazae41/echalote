import { Binary } from "@hazae41/binary";
import { KcpReader } from "./reader.js";
import { KcpWriter } from "./writer.js";

export class KcpStream {

  readonly reader: KcpReader
  readonly writer: KcpWriter

  readonly conversation = Binary.random(4).getUint32(true)

  send_counter = 0
  recv_counter = 0

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.reader = new KcpReader(this)
    this.writer = new KcpWriter(this)
  }

}