import { writeAll } from "https://deno.land/std@0.157.0/streams/mod.ts";

const server = Deno.listen({ port: 8080 })

for await (const conn of server)
  onconn(conn)

async function read(reader: Deno.Reader) {
  const p = new Uint8Array(32 * 1024)
  const n = await reader.read(p)
  if (n) return p.subarray(0, n)
}

async function onconn(conn: Deno.Conn) {
  const http = Deno.serveHttp(conn)

  for await (const { request, respondWith } of http) {
    try {
      const { socket, response } = Deno.upgradeWebSocket(request);

      onsocket(socket)

      await respondWith(response)
    } catch (_: unknown) {
      await respondWith(new Response(undefined, { status: 500 }))
    }
  }
}

async function onsocket(socket: WebSocket) {
  socket.binaryType = "arraybuffer"

  const target = await Deno.connect({ hostname: "127.0.0.1", port: 9001, transport: "tcp" })

  socket.addEventListener("message", async e => {
    try {
      const buffer = new Uint8Array(e.data)
      console.debug("->", buffer)
      await writeAll(target, buffer)
    } catch (_: unknown) {
      socket.close()
      return
    }
  })

  while (true) {
    try {
      const output = await read(target)

      if (!output) {
        socket.close()
        return
      }

      console.debug("<-", output)
      socket.send(output)
    } catch (_: unknown) {
      socket.close()
      return
    }
  }
}