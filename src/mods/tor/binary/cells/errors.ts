import { Circuit } from "mods/tor/circuit.js"
import { TcpStream } from "mods/tor/streams/tcp.js"

export class InvalidCommand extends Error {
  constructor(
    readonly name: string,
    readonly command: number
  ) {
    super(`Invalid ${name} command ${command}`)
  }
}

export class InvalidRelayCommand extends Error {
  constructor(
    readonly name: string,
    readonly command: number
  ) {
    super(`Invalid ${name} relay command ${command}`)
  }
}

export class InvalidCircuit extends Error {
  constructor(
    readonly name: string,
    readonly circuit?: Circuit
  ) {
    super(`Invalid ${name} circuit ${circuit?.id}`)
  }
}

export class InvalidStream extends Error {
  constructor(
    readonly name: string,
    readonly stream?: TcpStream
  ) {
    super(`Invalid ${name} circuit ${stream?.id}`)
  }
}