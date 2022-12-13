import { fixedCiphersuites } from "libs/forge.js"
import { Tls } from "mods/tls/tls.js"

export class TlsOverWs extends Tls {
  readonly #class = TlsOverWs

  readonly connection

  constructor(
    readonly socket: WebSocket
  ) {
    super()

    socket.addEventListener("message", async e => {
      const buffer = Buffer.from(await e.data.arrayBuffer())
      this.connection.process(buffer.toString("binary"))
    }, { passive: true })

    this.connection = window.forge.tls.createConnection({
      server: false,
      cipherSuites: Object.values(fixedCiphersuites) as any,
      verify: (connection, verified, depth, certs) => {
        return true;
      },
      connected: (connection) => {
        this.dispatchEvent(new Event("open"))
      },
      tlsDataReady: (connection) => {
        const bytes = connection.tlsData.getBytes();
        const data = Buffer.from(bytes, "binary")
        this.socket.send(data)
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

}