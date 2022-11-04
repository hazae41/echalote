import { Future } from "libs/future.js"
import type { tls } from "node-forge"

export abstract class Tls extends EventTarget {
  readonly abstract connection: tls.Connection

  protected _closed = false

  get closed() {
    return this._closed
  }

  send(array: Buffer) {
    const binary = array.toString("binary")
    this.connection.prepare(binary)
  }

  private async waitOpen() {
    const future = new Future<Event, Event>()

    try {
      this.addEventListener("close", future.err, { passive: true })
      this.addEventListener("error", future.err, { passive: true })
      this.addEventListener("open", future.ok, { passive: true })
      await future.promise
    } finally {
      this.removeEventListener("error", future.err)
      this.removeEventListener("close", future.err)
      this.removeEventListener("open", future.ok)
    }
  }

  async open() {
    const wait = this.waitOpen()
    this.connection.handshake()
    await wait
  }
}