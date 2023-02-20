import { iterateReader } from "https://deno.land/std@0.172.0/streams/mod.ts";

const server = Deno.listen({ hostname: "0.0.0.0", port: 9002 })

for await (const conn of server)
  onconn(conn)

async function onconn(conn: Deno.Conn) {
  const target = await Deno.connect({ hostname: "localhost", port: 9001, transport: "tcp" })

  console.log("open")

  const read = copy(conn, target, "->").catch(() => { })
  const write = copy(target, conn, "<-").catch(() => { })

  await Promise.all([read, write])

  target.close()
  conn.close()

  console.log("close")
}

async function copy(reader: Deno.Reader, writer: Deno.Writer, symbol: string) {
  for await (const chunk of iterateReader(reader)) {
    console.log(symbol, chunk)
    await writer.write(chunk)
  }
}