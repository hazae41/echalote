import { fixedCiphersuites } from "libs/forge.js";
import { Tls } from "mods/tls/tls.js";

export class TlsOverHttp extends Tls {
  readonly class = TlsOverHttp

  readonly connection

  constructor(
    readonly info: RequestInfo
  ) {
    super()

    setInterval(() => {
      this.fetch()
    }, 500)

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
        await this.fetch(Buffer.from(bytes, "binary"))
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

  async fetch(body?: Buffer) {
    const res = await fetch(this.info, { method: "POST", body })

    if (!res.ok) {
      const error = new Error(await res.text())

      const event = new ErrorEvent("error", { error })
      if (!this.dispatchEvent(event)) return

      return
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    this.connection.process(buffer.toString("binary"))
  }

}