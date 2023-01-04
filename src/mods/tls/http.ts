import { fixedCiphersuites } from "libs/forge.js";
import { Tls } from "mods/tls/tls.js";
import { tls } from "node-forge";

export class TlsOverHttp extends Tls {
  readonly #class = TlsOverHttp

  readonly connection: tls.Connection

  private queue = new Array<Buffer>()

  constructor(
    readonly info: RequestInfo
  ) {
    super()

    setInterval(() => {
      if (!this.queue.length) return
      this.fetchAll().catch(console.warn)
    }, 100)

    setInterval(() => {
      this.fetch().catch(console.warn)
    }, 1000)

    this.connection = window.forge.tls.createConnection({
      server: false,
      cipherSuites: Object.values(fixedCiphersuites) as any,
      verify: (connection, verified, depth, certs) => {
        return true;
      },
      connected: (connection) => {
        this.dispatchEvent(new Event("open"))
      },
      tlsDataReady: async (connection) => {
        const bytes = connection.tlsData.getBytes();
        this.queue.push(Buffer.from(bytes, "binary"))
      },
      dataReady: (connection) => {
        const bytes = connection.data.getBytes();
        const data = Buffer.from(bytes, "binary")

        const event = new MessageEvent("message", { data })
        if (!this.dispatchEvent(event)) return
      },
      closed: (connection) => {
        const event = new CloseEvent("close")
        if (!this.dispatchEvent(event)) return

        this._closed = true
      },
      error: (connection, error) => {
        const event = new ErrorEvent("error", { error })
        if (!this.dispatchEvent(event)) return
      }
    });
  }

  async fetchAll() {
    const body = Buffer.concat(this.queue)

    this.queue = []

    await this.fetch(body)
  }

  async fetch(body?: Buffer) {
    console.log("->", body?.toString("hex"))
    const res = await fetch(this.info, { method: "POST", body })
    const buffer = Buffer.from(await res.arrayBuffer())
    console.log("<-", buffer.toString("hex"))
    this.connection.process(buffer.toString("binary"))
  }

}