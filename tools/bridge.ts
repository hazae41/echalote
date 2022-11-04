import { writeAll } from "https://deno.land/std@0.157.0/streams/mod.ts";

const headers = {
  "Access-Control-Allow-Origin": "*"
}

const server = Deno.listen({ port: 8080 });

async function read(reader: Deno.Reader) {
  const p = new Uint8Array(32 * 1024)
  const n = await reader.read(p)
  if (n) return p.slice(0, n)
}

async function onconn(conn: Deno.Conn) {
  const http = Deno.serveHttp(conn);

  for await (const { request, respondWith } of http) {
    try {
      const { socket, response } = Deno.upgradeWebSocket(request);
      const onion = await Deno.connect({ hostname: "127.0.0.1", port: 9001, transport: "tcp" })

      socket.onmessage = async e => {
        try {
          const buffer = new Uint8Array(e.data)
          console.debug("->", buffer)
          await writeAll(onion, buffer)
        } catch (_: unknown) {
          socket.close()
          return
        }
      }

      readloop(socket, onion)
      await respondWith(response);
    } catch (_: unknown) {
      await respondWith(new Response(undefined, { status: 500 }))
    }
  }
}

async function readloop(socket: WebSocket, onion: Deno.TcpConn) {
  while (true) {
    try {
      const output = await read(onion)

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

for await (const conn of server)
  onconn(conn);