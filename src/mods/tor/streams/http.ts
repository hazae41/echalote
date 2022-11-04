import { Binary } from "libs/binary.js"
import { Future } from "libs/future.js"
import { Strings } from "libs/strings.js"

export type HttpState =
  | HttpNoneState
  | HttpHeadedState

export interface HttpNoneState {
  type: "none"
  buffer: Binary
}

export interface HttpHeadedState {
  type: "headed",
  length: number,
  version: string,
  encoding: HttpEncoding
}

export type HttpEncoding =
  | HttpChunkedEncoding
  | HttpLengthedEncoding

export interface HttpChunkedEncoding {
  type: "chunked",
  buffer: Binary
}

export interface HttpLengthedEncoding {
  type: "lengthed",
  length: number
}

export class HttpStream extends EventTarget {
  readonly res = new Future<Response, unknown>()

  /**
   * HTTP output bufferer
   */
  readonly rstreams = new TransformStream<Buffer, Buffer>()

  /**
   * HTTP input bufferer
   */
  readonly wstreams = new TransformStream<Buffer, Buffer>()

  state: HttpState = { type: "none", buffer: Binary.allocUnsafe(10 * 1024) }

  constructor(
    readonly sstreams: ReadableWritablePair<Buffer, Buffer>,
    readonly req = new Request("/"),
    readonly url = new URL(req.url)
  ) {
    super()

    if (req.body)
      req.body.pipeTo(this.wstreams.writable)
    else
      this.wstreams.writable.close()

    this.tryRead().catch(console.error)
    this.tryWrite().catch(console.error)
  }

  private async tryWrite() {
    const reader = this.wstreams.readable.getReader()

    try {
      await this.write(reader)
    } catch (e: unknown) {
      console.error(e)

      const writer = this.sstreams.writable.getWriter()
      writer.abort(e)
      writer.releaseLock()
    } finally {
      reader.releaseLock()
    }
  }

  private async write(reader: ReadableStreamReader<Buffer>) {
    await this.onWriteStart()

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      await this.onWrite(value)
    }

    if (this.req.signal.aborted) return

    await this.onWriteEnd()
  }

  private async onWriteStart() {
    let head = `${this.req.method} ${this.url.pathname} HTTP/1.1\r\n`
    head += `Host: ${this.url.host}\r\n`
    head += `Transfer-Encoding: chunked\r\n`
    this.req.headers.forEach((v, k) => head += `${k}: ${v}\r\n`)
    head += `\r\n`

    const writer = this.sstreams.writable.getWriter()
    writer.write(Buffer.from(head))
    writer.releaseLock()
  }

  private async onWrite(chunk: Buffer) {
    const length = chunk.length.toString(16)
    const line = `${length}\r\n${chunk.toString()}\r\n`

    const writer = this.sstreams.writable.getWriter()
    writer.write(Buffer.from(line))
    writer.releaseLock()
  }

  private async onWriteEnd() {
    const buffer = Buffer.from(`0\r\n\r\n\r\n`)

    const writer = this.sstreams.writable.getWriter()
    writer.write(buffer)
    writer.close()
    writer.releaseLock()
  }

  private async tryRead() {
    const reader = this.sstreams.readable.getReader()

    try {
      await this.read(reader)
    } catch (e: unknown) {
      console.error(e)

      const writer = this.rstreams.writable.getWriter()
      writer.abort(e)
      writer.releaseLock()

      this.res.err(e)
    } finally {
      reader.releaseLock()
    }
  }

  private async read(reader: ReadableStreamReader<Buffer>) {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      await this.onRead(value)
    }
  }

  private async onRead(chunk: Buffer) {
    if (this.state.type === "none") {
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

      const encoding = headers.get("transfer-encoding")

      if (encoding === "chunked") {
        const encoding: HttpChunkedEncoding = { type: "chunked", buffer: Binary.allocUnsafe(10 * 1024) }
        this.state = { type: "headed", version, encoding, length: 0 }
      } else if (encoding === null) {
        const length = Number(headers.get("content-length"))
        const encoding: HttpLengthedEncoding = { type: "lengthed", length }
        this.state = { type: "headed", version, encoding, length: 0 }
      } else {
        throw new Error(`Unsupported encoding ${encoding}`)
      }

      chunk = body
    }

    if (this.state.encoding.type === "lengthed") {
      const writer = this.rstreams.writable.getWriter()
      writer.write(chunk)

      this.state.length += chunk.length

      if (this.state.length > this.state.encoding.length)
        console.warn(`Length > Content-Length`)
      if (this.state.length >= this.state.encoding.length)
        writer.close()

      writer.releaseLock()
      return
    }

    if (this.state.encoding.type === "chunked") {
      const { buffer } = this.state.encoding

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
          writer.close()
          writer.releaseLock()
          return
        }

        // len(...) < length + len(\r\n) => partial chunk => wait
        if (rest.length < length + 2) break

        // ([length]\r\n)[chunk]\r\n(...) => full chunk => split it
        const chunk2 = rest.subarray(0, length)
        const rest2 = rest.subarray(length + 2)

        const writer = this.rstreams.writable.getWriter()
        writer.write(chunk2)
        writer.releaseLock()

        buffer.offset = 0
        buffer.write(rest2)

        slice = buffer.buffer.subarray(0, buffer.offset)
      }

      return
    }
  }
}