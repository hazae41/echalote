import { X25519PublicKey, X25519StaticSecret } from "@hazae41/berith";
import { Ciphers, TlsStream } from "@hazae41/cadenas";
import { fetch } from "@hazae41/fleche";
import { Sha1Hasher } from "@hazae41/morax";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { randomOf } from "libs/array.js";
import { Bitmask } from "libs/bits.js";
import { Bytes } from "libs/bytes/bytes.js";
import { Events } from "libs/events.js";
import { Future } from "libs/future.js";
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

export class Circuit extends EventTarget {
  readonly #class = Circuit

  private _nonce = 1
  private _closed = false

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, TcpStream>()

  constructor(
    readonly tor: Tor,
    readonly id: number
  ) {
    super()

    const onClose = this.onClose.bind(this)
    this.tor.addEventListener("close", onClose, { passive: true })

    const onError = this.onError.bind(this)
    this.tor.addEventListener("error", onError, { passive: true })

    const onDestroyCell = this.onDestroyCell.bind(this)
    this.tor.addEventListener("DESTROY", onDestroyCell, { passive: true })

    const onRelayExtended2Cell = this.onRelayExtended2Cell.bind(this)
    this.tor.addEventListener("RELAY_EXTENDED2", onRelayExtended2Cell, { passive: true })

    const onRelayTruncatedCell = this.onRelayTruncatedCell.bind(this)
    this.tor.addEventListener("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true })

    const onRelayConnectedCell = this.onRelayConnectedCell.bind(this)
    this.tor.addEventListener("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })

    const onRelayDataCell = this.onRelayDataCell.bind(this)
    this.tor.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.onRelayEndCell.bind(this)
    this.tor.addEventListener("RELAY_END", onRelayEndCell, { passive: true })
  }

  get closed() {
    return this._closed
  }

  private async onClose(e: Event) {
    const event = Events.clone(e) as CloseEvent
    if (!this.dispatchEvent(event)) return
  }

  private async onError(e: Event) {
    const event = Events.clone(e) as ErrorEvent
    if (!this.dispatchEvent(event)) return
  }

  private async onDestroyCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<DestroyCell>
    if (event.data.circuit !== this) return
    if (!this.dispatchEvent(event)) return

    const event2 = new ErrorEvent("error", { error: event.data })
    if (!this.dispatchEvent(event2)) return
  }

  private async onRelayExtended2Cell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayExtended2Cell>
    if (event.data.circuit !== this) return
    if (!this.dispatchEvent(event)) return
  }

  private async onRelayTruncatedCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayTruncatedCell>
    if (event.data.circuit !== this) return
    if (!this.dispatchEvent(event)) return

    const event2 = new ErrorEvent("error", { error: event.data })
    if (!this.dispatchEvent(event2)) return
  }

  private async onRelayConnectedCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayConnectedCell>
    if (event.data.circuit !== this) return
    if (!this.dispatchEvent(event)) return
  }

  private async onRelayDataCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayDataCell>
    if (event.data.circuit !== this) return
    if (!this.dispatchEvent(event)) return
  }

  private async onRelayEndCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayEndCell>
    if (event.data.circuit !== this) return
    if (!this.dispatchEvent(event)) return

    this.streams.delete(event.data.stream.id)
  }

  private async waitExtended(signal?: AbortSignal) {
    const future = new Future<Event>()

    try {
      signal?.addEventListener("abort", future.err, { passive: true })
      this.addEventListener("close", future.err, { passive: true })
      this.addEventListener("error", future.err, { passive: true })
      this.addEventListener("RELAY_EXTENDED2", future.ok, { passive: true })

      return await future.promise as MessageEvent<RelayExtended2Cell>
    } finally {
      signal?.removeEventListener("abort", future.err)
      this.removeEventListener("error", future.err)
      this.removeEventListener("close", future.err)
      this.removeEventListener("RELAY_EXTENDED2", future.ok)
    }
  }

  async extendDir() {
    const authority = randomOf(this.tor.authorities.filter(it => it.v3ident))

    if (!authority)
      throw new Error(`Could not find authority`)

    await this._extend({
      hosts: [authority.ipv4],
      id: authority.v3ident!,
      onion: authority.fingerprint,
    })
  }

  async extend(exit: boolean) {
    const fallback = randomOf(this.tor.fallbacks[exit ? "exits" : "middles"])

    if (!fallback)
      throw new Error(`Could not find fallback`)

    return await this._extend(fallback)
  }

  async _extend(fallback: Fallback, signal?: AbortSignal) {
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

    const pextended2 = this.waitExtended(signal)
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

  private async waitTruncated(signal?: AbortSignal) {
    const future = new Future<Event, Event>()

    try {
      signal?.addEventListener("abort", future.err, { passive: true })
      this.addEventListener("close", future.err, { passive: true })
      this.addEventListener("error", future.err, { passive: true })
      this.addEventListener("RELAY_TRUNCATED", future.ok, { passive: true })

      return await future.promise as MessageEvent<RelayTruncatedCell>
    } finally {
      signal?.removeEventListener("abort", future.err)
      this.removeEventListener("error", future.err)
      this.removeEventListener("close", future.err)
      this.removeEventListener("RELAY_TRUNCATED", future.ok)
    }
  }

  async truncate(reason = RelayTruncateCell.reasons.NONE) {
    const ptruncated = this.waitTruncated()
    const relay_truncate = new RelayTruncateCell(this, undefined, reason)
    this.tor.output.enqueue(await relay_truncate.pack())
    await ptruncated
  }

  async open(hostname: string, port: number, signal?: AbortSignal) {
    const streamId = this._nonce++

    const stream = new TcpStream(this, streamId, signal)
    this.streams.set(streamId, stream)

    const flags = new Bitmask(0)
      .set(RelayBeginCell.flags.IPV4_OK, true)
      .set(RelayBeginCell.flags.IPV6_NOT_OK, false)
      .set(RelayBeginCell.flags.IPV6_PREFER, true)
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
    const req = new Request(input, init)

    const url = new URL(req.url)
    const port = Number(url.port) || 80
    const tcp = await this.open(url.hostname, port, req.signal)

    if (url.protocol === "http:")
      return fetch(input, { ...init, stream: tcp })

    if (url.protocol === "https:") {
      const ciphers = [Ciphers.TLS_DHE_RSA_WITH_AES_256_CBC_SHA]
      const tls = new TlsStream(tcp, { ciphers, debug: true })

      await tls.handshake()

      return fetch(input, { ...init, stream: tls })
    }

    throw new Error(`Unknown protocol ${url.protocol}`)
  }
}