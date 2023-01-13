import { Binary } from "@hazae41/binary";
import { GzDecoder } from "@hazae41/foras";
import { Future } from "libs/future.js";
import { Strings } from "libs/strings.js";

export type HttpState =
  | HttpNoneState
  | HttpHeadedState

export interface HttpNoneState {
  type: "none"
  buffer: Binary
}

export interface HttpHeadedState {
  type: "headed",
  version: string,
  transfer: HttpTransfer,
  compression: HttpCompression
}

export type HttpTransfer =
  | HttpChunkedTransfer
  | HttpLengthedTransfer

export interface HttpChunkedTransfer {
  type: "chunked",
  buffer: Binary
}

export interface HttpLengthedTransfer {
  type: "lengthed",
  offset: number,
  length: number
}

export type HttpCompression =
  | HttpNoneCompression
  | HttpGzipCompression

export interface HttpNoneCompression {
  type: "none"
}

export interface HttpGzipCompression {
  type: "gzip"
  decoder: GzDecoder
}

export class HttpStream extends EventTarget {
  readonly res = new Future<Response, unknown>()

  /**
   * HTTP output bufferer
   */
  readonly rstreams = new TransformStream<Uint8Array, Uint8Array>()

  /**
   * HTTP input bufferer
   */
  readonly wstreams = new TransformStream<Uint8Array, Uint8Array>()

  state: HttpState = { type: "none", buffer: Binary.allocUnsafe(10 * 1024) }

  /**
   * HTTP 1.1
   * @implements chunked encoding request/response
   * @implements lengthed encoding response
   * @implements uncompressed request/response
   * @implements gzip compressed response
   */
  constructor(
    readonly sstreams: ReadableWritablePair<Uint8Array, Uint8Array>,
    readonly req: Request
  ) {
    super()

    if (req.body)
      req.body.pipeTo(this.wstreams.writable).catch(console.warn)
    else
      this.wstreams.writable.close().catch(console.warn)

    this.tryRead().catch(console.warn)
    this.tryWrite().catch(console.warn)
  }

  private async tryWrite() {
    const reader = this.wstreams.readable.getReader()

    try {
      await this.write(reader)
    } catch (e: unknown) {
      console.warn(e)

      const writer = this.sstreams.writable.getWriter()
      writer.abort(e).catch(console.warn)
      writer.releaseLock()

      this.res.err(e)
    } finally {
      reader.releaseLock()
    }
  }

  private async write(reader: ReadableStreamDefaultReader<Uint8Array>) {
    await this.onWriteStart()

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      await this.onWrite(value)
    }

    await this.onWriteEnd()
  }

  private async onWriteStart() {
    const url = new URL(this.req.url)

    let head = ``
    head += `${this.req.method} ${url.pathname} HTTP/1.1\r\n`
    head += `Host: ${url.host}\r\n`
    head += `Transfer-Encoding: chunked\r\n`
    head += `Accept-Encoding: gzip\r\n`
    this.req.headers.forEach((v, k) => head += `${k}: ${v}\r\n`)
    head += `\r\n`

    const writer = this.sstreams.writable.getWriter()
    writer.write(Buffer.from(head)).catch(console.warn)
    writer.releaseLock()
  }

  private async onWrite(chunk: Uint8Array) {
    const text = new TextDecoder().decode(chunk)
    const length = text.length.toString(16)
    const line = `${length}\r\n${text}\r\n`

    const writer = this.sstreams.writable.getWriter()
    writer.write(Buffer.from(line)).catch(console.warn)
    writer.releaseLock()
  }

  private async onWriteEnd() {
    const buffer = Buffer.from(`0\r\n\r\n\r\n`)

    const writer = this.sstreams.writable.getWriter()
    writer.write(buffer).catch(console.warn)
    writer.close().catch(console.warn)
    writer.releaseLock()
  }

  private async tryRead() {
    const reader = this.sstreams.readable.getReader()

    try {
      await this.read(reader)
    } catch (e: unknown) {
      console.warn(e)

      const writer = this.rstreams.writable.getWriter()
      writer.abort(e).catch(console.warn)
      writer.releaseLock()

      this.res.err(e)
    } finally {
      reader.releaseLock()
    }
  }

  private async read(reader: ReadableStreamDefaultReader<Uint8Array>) {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      await this.onRead(value)
    }
  }

  private async onRead(chunk: Uint8Array) {
    if (this.state.type === "none") {
      const result = await this.onReadNone(chunk)
      if (!result) return
      chunk = result
    }

    if (this.state.type !== "headed")
      return

    if (this.state.transfer.type === "lengthed") {
      await this.onReadLenghted(chunk)
      return
    }

    if (this.state.transfer.type === "chunked") {
      await this.onReadChunked(chunk)
      return
    }
  }

  private getTransferFromHeaders(headers: Headers): HttpTransfer {
    const type = headers.get("transfer-encoding")

    if (type === "chunked") {
      const buffer = Binary.allocUnsafe(10 * 1024)
      return { type, buffer }
    }

    if (type === null) {
      const length = Number(headers.get("content-length"))
      return { type: "lengthed", offset: 0, length }
    }

    throw new Error(`Unsupported transfer ${type}`)
  }

  private getCompressionFromHeaders(headers: Headers): HttpCompression {
    const type = headers.get("content-encoding")

    if (type === "gzip") {
      const decoder = new GzDecoder()
      return { type, decoder }
    }

    if (type === null) {
      return { type: "none" }
    }

    throw new Error(`Unsupported compression ${type}`)
  }

  private async onReadNone(chunk: Uint8Array) {
    if (this.state.type !== "none")
      return
    const { buffer } = this.state

    buffer.write(chunk)

    const split = buffer.buffer.indexOf("\r\n\r\n")

    if (split === -1) return

    const head = buffer.buffer.subarray(0, split)
    const body = buffer.buffer.subarray(split + "\r\n\r\n".length, buffer.offset)

    const [info, ...rawHeaders] = head.toString().split("\r\n")
    const [version, statusString, statusText] = info.split(" ")

    const status = Number(statusString)
    const headers = new Headers(rawHeaders.map(it => Strings.splitOnce(it, ": ")))
    this.res.ok(new Response(this.rstreams.readable, { headers, status, statusText }))

    const transfer = this.getTransferFromHeaders(headers)
    const compression = this.getCompressionFromHeaders(headers)

    this.state = { type: "headed", version, transfer, compression }

    return body
  }

  private async onReadLenghted(chunk: Uint8Array) {
    if (this.state.type !== "headed")
      return
    if (this.state.transfer.type !== "lengthed")
      return
    const { transfer, compression } = this.state

    transfer.offset += chunk.length

    if (transfer.offset > transfer.length)
      throw new Error(`Length > Content-Length`)

    const writer = this.rstreams.writable.getWriter()

    if (compression.type === "none") {
      writer.write(chunk).catch(console.warn)
    } else if (compression.type === "gzip") {
      compression.decoder.write(chunk)
      compression.decoder.flush()

      const dchunk = compression.decoder.read()
      const bdchunk = Buffer.from(dchunk.buffer)
      writer.write(bdchunk).catch(console.warn)
    }

    if (transfer.offset === transfer.length) {
      if (compression.type === "gzip") {
        const fchunk = compression.decoder.finish()
        const bfchunk = Buffer.from(fchunk.buffer)
        writer.write(bfchunk).catch(console.warn)
      }

      writer.close().catch(console.warn)
    }

    writer.releaseLock()
  }

  private async onReadChunked(chunk: Uint8Array) {
    if (this.state.type !== "headed")
      return
    if (this.state.transfer.type !== "chunked")
      return
    const { transfer, compression } = this.state
    const { buffer } = transfer

    buffer.write(chunk)

    let slice = buffer.buffer.subarray(0, buffer.offset)

    while (slice.length) {
      const index = slice.indexOf("\r\n")

      // [...] => partial header => wait
      if (index === -1) return

      // [length]\r\n(...) => full header => split it
      const length = parseInt(slice.subarray(0, index).toString(), 16)
      const rest = slice.subarray(index + 2)

      if (length === 0) {
        const writer = this.rstreams.writable.getWriter()

        if (compression.type === "gzip") {
          const fchunk = compression.decoder.finish()
          const bfchunk = Buffer.from(fchunk.buffer)
          writer.write(bfchunk).catch(console.warn)
        }

        writer.close().catch(console.warn)
        writer.releaseLock()
        return
      }

      // len(...) < length + len(\r\n) => partial chunk => wait
      if (rest.length < length + 2) break

      // ([length]\r\n)[chunk]\r\n(...) => full chunk => split it
      const chunk2 = rest.subarray(0, length)
      const rest2 = rest.subarray(length + 2)

      const writer = this.rstreams.writable.getWriter()

      if (compression.type === "none") {
        writer.write(chunk2).catch(console.warn)
      } else if (compression.type === "gzip") {
        compression.decoder.write(chunk2)
        compression.decoder.flush()

        const dchunk2 = compression.decoder.read()
        const bdchunk2 = Buffer.from(dchunk2.buffer)
        writer.write(bdchunk2).catch(console.warn)
      }

      writer.releaseLock()

      buffer.offset = 0
      buffer.write(rest2)

      slice = buffer.buffer.subarray(0, buffer.offset)
    }
  }
}