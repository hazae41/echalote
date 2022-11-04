const server = Deno.listen({ port: 80 });

async function onconn(conn: Deno.Conn) {
  const http = Deno.serveHttp(conn);

  for await (const { request, respondWith } of http) {
    try {
      respondWith(fetch("https://orbitum.space/api/topics", request))
    } catch (e: unknown) {
      console.error(e)
    }
  }
}

for await (const conn of server)
  onconn(conn);