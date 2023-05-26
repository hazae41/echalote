import { SecretTorStreamDuplex } from "mods/tor/stream.js"

export class InvalidStream extends Error {

  constructor(
    readonly name: string,
    readonly stream?: SecretTorStreamDuplex
  ) {
    super(`Invalid ${name} circuit ${stream?.id}`)
  }

}