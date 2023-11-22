Deno.serve({ port: 8080 }, async (request: Request) => {
  if (request.method === "OPTIONS") {
    const headers = new Headers()
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Headers", "*")

    return new Response(undefined, { headers })
  }

  const response = await fetch("https://meek.bamsoftware.com/", request)

  const { body, status } = response

  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", "*")
  headers.set("Access-Control-Allow-Headers", "*")

  return new Response(body, { headers, status })
});