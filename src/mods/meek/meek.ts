import { BatchedFetchStream } from "libs/transports/http.js"

export async function createMeekStream(url: string) {
  const headers = { "x-session-id": crypto.randomUUID() }
  const request = new Request(url, { headers })

  return new BatchedFetchStream(request, { highDelay: 100 })
}