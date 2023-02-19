import { X25519PublicKey, X25519StaticSecret } from "@hazae41/berith";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { Ciphers, TlsStream } from "@hazae41/cadenas";
import { fetch } from "@hazae41/fleche";
import { Sha1Hasher } from "@hazae41/morax";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { Arrays } from "libs/arrays/arrays.js";
import { AbortEvent } from "libs/events/abort.js";
import { ErrorEvent } from "libs/events/error.js";
import { Events } from "libs/events/events.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { Ntor } from "mods/tor/algos/ntor/index.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { RelayBeginCell } from "mods/tor/binary/cells/relayed/relay_begin/cell.js";
import { RelayConnectedCell } from "mods/tor/binary/cells/relayed/relay_connected/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { RelayExtend2Cell } from "mods/tor/binary/cells/relayed/relay_extend2/cell.js";
import { RelayExtend2Link, RelayExtend2LinkIPv4, RelayExtend2LinkIPv6, RelayExtend2LinkLegacyID, RelayExtend2LinkModernID } from "mods/tor/binary/cells/relayed/relay_extend2/link.js";
import { RelayExtended2Cell } from "mods/tor/binary/cells/relayed/relay_extended2/cell.js";
import { RelayTruncateCell } from "mods/tor/binary/cells/relayed/relay_truncate/cell.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated/cell.js";
import { TcpStream } from "mods/tor/streams/tcp.js";
import { Target } from "mods/tor/target.js";
import { Fallback, Tor } from "mods/tor/tor.js";

export class Circuit extends AsyncEventTarget {
  readonly #class = Circuit

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, TcpStream>()

  #nonce = 1
  #closed = false

  constructor(
    readonly tor: Tor,
    readonly id: number
  ) {
    super()

    const onClose = this.#onReadClose.bind(this)
    this.tor.read.addEventListener("close", onClose, { passive: true })

    const onError = this.#onReadError.bind(this)
    this.tor.read.addEventListener("error", onError, { passive: true })

    const onDestroyCell = this.#onDestroyCell.bind(this)
    this.tor.addEventListener("DESTROY", onDestroyCell, { passive: true })

    const onRelayExtended2Cell = this.#onRelayExtended2Cell.bind(this)
    this.tor.addEventListener("RELAY_EXTENDED2", onRelayExtended2Cell, { passive: true })

    const onRelayTruncatedCell = this.#onRelayTruncatedCell.bind(this)
    this.tor.addEventListener("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true })

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this)
    this.tor.addEventListener("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    this.tor.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.#onRelayEndCell.bind(this)
    this.tor.addEventListener("RELAY_END", onRelayEndCell, { passive: true })
  }

  get closed() {
    return this.#closed
  }

  async #onReadClose(event: Event) {
    const closeEvent = event as CloseEvent

    console.debug(`${this.#class.name}.onReadClose`, event)

    this.#closed = true

    const closeEventClone = Events.clone(closeEvent)
    if (!await this.dispatchEvent(closeEventClone)) return
  }

  async #onReadError(event: Event) {
    const errorEvent = event as ErrorEvent

    console.debug(`${this.#class.name}.onReadError`, event)

    this.#closed = true

    const errorEventClone = Events.clone(errorEvent)
    if (!await this.dispatchEvent(errorEventClone)) return
  }

  async #onDestroyCell(event: Event) {
    const msgEvent = event as MessageEvent<DestroyCell>
    if (msgEvent.data.circuit !== this) return

    console.debug(`${this.#class.name}.onDestroyCell`, event)

    this.#closed = true

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return

    const error = new Error(`Circuit destroyed`, { cause: msgEvent.data })

    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.dispatchEvent(errorEvent)) return
  }

  async #onRelayExtended2Cell(event: Event) {
    const msgEvent = event as MessageEvent<RelayExtended2Cell>
    if (msgEvent.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayExtended2Cell`, event)

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return
  }

  async #onRelayTruncatedCell(event: Event) {
    const msgEvent = event as MessageEvent<RelayTruncatedCell>
    if (msgEvent.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayTruncatedCell`, event)

    this.#closed = true

    const msgEventClone = Events.clone(event)
    if (!await this.dispatchEvent(msgEventClone)) return

    const error = new Error(`Circuit truncated`, { cause: msgEvent.data })

    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.dispatchEvent(errorEvent)) return
  }

  async #onRelayConnectedCell(event: Event) {
    const msgEvent = event as MessageEvent<RelayConnectedCell>
    if (msgEvent.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayConnectedCell`, event)

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return
  }

  async #onRelayDataCell(event: Event) {
    const msgEvent = event as MessageEvent<RelayDataCell>
    if (msgEvent.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayDataCell`, event)

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return
  }

  async #onRelayEndCell(event: Event) {
    const msgEvent = event as MessageEvent<RelayEndCell>
    if (msgEvent.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayEndCell`, event)

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return

    this.streams.delete(msgEvent.data.stream.id)
  }

  async #waitExtended(signal?: AbortSignal) {
    const future = new Future<Event, Error>()

    const onAbort = (event: Event) => {
      const abortEvent = event as AbortEvent
      const error = new Error(`Aborted`, { cause: abortEvent.target.reason })
      future.err(error)
    }

    const onClose = (event: Event) => {
      const closeEvent = event as CloseEvent
      const error = new Error(`Closed`, { cause: closeEvent })
      future.err(error)
    }

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      const error = new Error(`Errored`, { cause: errorEvent })
      future.err(error)
    }

    try {
      signal?.addEventListener("abort", onAbort, { passive: true })
      this.addEventListener("close", onClose, { passive: true })
      this.addEventListener("error", onError, { passive: true })
      this.addEventListener("RELAY_EXTENDED2", future.ok, { passive: true })

      return await future.promise as MessageEvent<RelayExtended2Cell>
    } finally {
      signal?.removeEventListener("abort", onAbort)
      this.removeEventListener("close", onClose)
      this.removeEventListener("error", onError)
      this.removeEventListener("RELAY_EXTENDED2", future.ok)
    }
  }

  async extendDir() {
    const authority = Arrays.randomOf(this.tor.authorities.filter(it => it.v3ident))

    if (!authority)
      throw new Error(`Could not find authority`)

    await this.extendTo({
      hosts: [authority.ipv4],
      id: authority.v3ident!,
      onion: authority.fingerprint,
    })
  }

  async extend(exit: boolean) {
    while (true) {
      if (this.closed)
        throw new Error(`Circuit is closed`)

      const fallbacks = exit
        ? this.tor.params.fallbacks.filter(it => it.exit)
        : this.tor.params.fallbacks
      const fallback = Arrays.randomOf(fallbacks)

      if (!fallback)
        throw new Error(`Could not find fallback`)

      const aborter = new AbortController()
      const { signal } = aborter

      setTimeout(() => aborter.abort(), 5 * 1000)

      try {
        return await this.extendTo(fallback, signal)
      } catch (e: unknown) {
        console.warn("Extend failed", e)

        if (this.closed) throw e
      }

      await new Promise(ok => setTimeout(ok, 1000))
    }
  }

  async extendTo(fallback: Fallback, signal?: AbortSignal) {
    const idh = Bytes.fromHex(fallback.id)

    const eid = fallback.eid
      ? Bytes.fromBase64(fallback.eid)
      : undefined

    const links: RelayExtend2Link[] = fallback.hosts
      .map(it => it.startsWith("[")
        ? RelayExtend2LinkIPv6.from(it)
        : RelayExtend2LinkIPv4.from(it))
    links.push(new RelayExtend2LinkLegacyID(idh))
    if (eid) links.push(new RelayExtend2LinkModernID(eid))

    const xsecretx = new X25519StaticSecret()
    const publicx = xsecretx.to_public().to_bytes()
    const publicb = new Uint8Array(fallback.onion)

    const request = Ntor.request(publicx, idh, publicb)

    const pextended2 = this.#waitExtended(signal)
    const relay_extend2 = new RelayExtend2Cell(this, undefined, RelayExtend2Cell.types.NTOR, links, request)
    this.tor.output.enqueue(await relay_extend2.pack())
    const extended2 = await pextended2

    const response = Ntor.response(extended2.data.data)

    const { publicy } = response
    const xpublicy = new X25519PublicKey(publicy)
    const xpublicb = new X25519PublicKey(publicb)

    const sharedxy = xsecretx.diffie_hellman(xpublicy).to_bytes()
    const sharedxb = xsecretx.diffie_hellman(xpublicb).to_bytes()

    const result = await Ntor.finalize(sharedxy, sharedxb, idh, publicb, publicx, publicy)

    const forwardDigest = new Sha1Hasher()
    const backwardDigest = new Sha1Hasher()

    forwardDigest.update(result.forwardDigest)
    backwardDigest.update(result.backwardDigest)

    const forwardKey = new Aes128Ctr128BEKey(result.forwardKey, Bytes.alloc(16))
    const backwardKey = new Aes128Ctr128BEKey(result.backwardKey, Bytes.alloc(16))

    const target = new Target(idh, this, forwardDigest, backwardDigest, forwardKey, backwardKey)

    this.targets.push(target)
  }

  async #waitTruncated(signal?: AbortSignal) {
    const future = new Future<Event, Error>()

    const onAbort = (event: Event) => {
      const abortEvent = event as AbortEvent
      const error = new Error(`Aborted`, { cause: abortEvent.target.reason })
      future.err(error)
    }

    const onClose = (event: Event) => {
      const closeEvent = event as CloseEvent
      const error = new Error(`Closed`, { cause: closeEvent })
      future.err(error)
    }

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      const error = new Error(`Errored`, { cause: errorEvent })
      future.err(error)
    }

    try {
      signal?.addEventListener("abort", onAbort, { passive: true })
      this.addEventListener("close", onClose, { passive: true })
      this.addEventListener("error", onError, { passive: true })
      this.addEventListener("RELAY_TRUNCATED", future.ok, { passive: true })

      return await future.promise as MessageEvent<RelayTruncatedCell>
    } finally {
      signal?.removeEventListener("abort", onAbort)
      this.removeEventListener("close", onClose)
      this.removeEventListener("error", onError)
      this.removeEventListener("RELAY_TRUNCATED", future.ok)
    }
  }

  async truncate(reason = RelayTruncateCell.reasons.NONE) {
    const ptruncated = this.#waitTruncated()
    const relay_truncate = new RelayTruncateCell(this, undefined, reason)
    this.tor.output.enqueue(await relay_truncate.pack())
    await ptruncated
  }

  async open(hostname: string, port: number, signal?: AbortSignal) {
    if (this.closed)
      throw new Error(`Circuit is closed`)

    const streamId = this.#nonce++

    const stream = new TcpStream(this, streamId, signal)
    this.streams.set(streamId, stream)

    const flags = new Bitset(0, 32)
      .setLE(RelayBeginCell.flags.IPV4_OK, true)
      .setLE(RelayBeginCell.flags.IPV6_NOT_OK, false)
      .setLE(RelayBeginCell.flags.IPV6_PREFER, true)
      .unsign()
      .value
    this.tor.output.enqueue(await new RelayBeginCell(this, stream, `${hostname}:${port}`, flags).pack())

    return stream
  }

  /**
   * Fetch using HTTP
   * @param input Fetch input
   * @param init Fetch init
   * @returns Response promise
   */
  async fetch(input: RequestInfo, init: RequestInit = {}) {
    if (this.closed)
      throw new Error(`Circuit is closed`)

    const req = new Request(input, init)

    const url = new URL(req.url)

    if (url.protocol === "http:") {
      const port = Number(url.port) || 80
      const tcp = await this.open(url.hostname, port, req.signal)

      return fetch(input, { ...init, stream: tcp })
    }

    if (url.protocol === "https:") {
      const port = Number(url.port) || 443
      const tcp = await this.open(url.hostname, port, req.signal)

      const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
      const tls = new TlsStream(tcp, { ciphers })

      return fetch(input, { ...init, stream: tls })
    }

    throw new Error(`Unknown protocol ${url.protocol}`)
  }
}