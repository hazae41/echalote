import { Cadenas } from "@hazae41/cadenas"
import { BatchedFetchStream } from "libs/transports/http.js"

export async function createMeekStream(url: string) {
  const headers = { "x-session-id": crypto.randomUUID() }
  const request = new Request(url, { headers })

  Cadenas.Console.debugging = true

  return new BatchedFetchStream(request)
}