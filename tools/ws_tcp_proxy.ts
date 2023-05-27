import { iterateReader, writeAll } from "https://deno.land/std@0.187.0/streams/mod.ts";

const server = Deno.listen({ port: 8080 })

for await (const conn of server)
  onconn(conn).catch(console.error)

async function pipeToWsAndLog(symbol: string, reader: Deno.Reader, socket: WebSocket) {
  for await (const bytes of iterateReader(reader)) {
    console.debug(symbol, bytes)
    socket.send(bytes)
  }
}

async function onconn(conn: Deno.Conn) {
  const http = Deno.serveHttp(conn)

  for await (const { request, respondWith } of http) {
    try {
      const { socket, response } = Deno.upgradeWebSocket(request);

      const target = await Deno.connect({ hostname: "127.0.0.1", port: 9001, transport: "tcp" })

      socket.binaryType = "arraybuffer"

      socket.addEventListener("message", async e => {
        try {
          const bytes = new Uint8Array(e.data)
          console.debug("->", bytes)
          await writeAll(target, bytes)
        } catch (_: unknown) {
          socket.close()
          target.close()
          return
        }
      })

      pipeToWsAndLog("<-", target, socket)
        .catch(console.error)
        .finally(() => {
          socket.close()
          target.close()
        })

      await respondWith(response)
    } catch (_: unknown) {
      await respondWith(new Response(undefined, { status: 500 }))
    }
  }
}