import { X25519PublicKey, X25519StaticSecret } from "@hazae41/berith";
import { Sha1Hasher } from "@hazae41/morax";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { randomOf } from "libs/array.js";
import { Bitmask } from "libs/bits.js";
import { Events } from "libs/events.js";
import { Future } from "libs/future.js";
import { ntor } from "mods/tor/algos/index.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy.js";
import { RelayBeginCell } from "mods/tor/binary/cells/relayed/relay_begin.js";
import { RelayConnectedCell } from "mods/tor/binary/cells/relayed/relay_connected.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end.js";
import { Link, LinkIPv4, LinkIPv6, LinkLegacyID, LinkModernID, RelayExtend2Cell } from "mods/tor/binary/cells/relayed/relay_extend2.js";
import { RelayExtended2Cell } from "mods/tor/binary/cells/relayed/relay_extended2.js";
import { RelayTruncateCell } from "mods/tor/binary/cells/relayed/relay_truncate.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated.js";
import { HttpStream } from "mods/tor/streams/http.js";
import { TcpStream } from "mods/tor/streams/tcp.js";
import { Target } from "mods/tor/target.js";
import { Fallback, Tor } from "mods/tor/tor.js";

export class Circuit extends EventTarget {
  readonly class = Circuit

  private _nonce = 1
  private _closed = false

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, TcpStream>()

  constructor(
    readonly tor: Tor,
    readonly id: number
  ) {
    super()

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

  private async onDestroyCell(event: Event) {
    const message = event as MessageEvent<DestroyCell>
    if (message.data.circuit !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    this._closed = true
  }

  private async onRelayExtended2Cell(event: Event) {
    const message = event as MessageEvent<RelayExtended2Cell>
    if (message.data.circuit !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return
  }

  private async onRelayTruncatedCell(event: Event) {
    const message = event as MessageEvent<RelayTruncatedCell>
    if (message.data.circuit !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return
  }

  private async onRelayConnectedCell(event: Event) {
    const message = event as MessageEvent<RelayConnectedCell>
    if (message.data.circuit !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return
  }

  private async onRelayDataCell(event: Event) {
    const message = event as MessageEvent<RelayDataCell>
    if (message.data.circuit !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return
  }

  private async onRelayEndCell(event: Event) {
    const message = event as MessageEvent<RelayEndCell>
    if (message.data.circuit !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    this.streams.delete(message.data.stream.id)
  }

  private async waitExtended() {
    const future = new Future<Event, Event>()

    try {
      this.tor.tls.addEventListener("close", future.err, { passive: true })
      this.tor.tls.addEventListener("error", future.err, { passive: true })
      this.addEventListener("DESTROY", future.err, { passive: true })
      this.addEventListener("RELAY_EXTENDED2", future.ok, { passive: true })
      return await future.promise as MessageEvent<RelayExtended2Cell>
    } catch (e: unknown) {
      throw Events.error(e)
    } finally {
      this.tor.tls.removeEventListener("error", future.err)
      this.tor.tls.removeEventListener("close", future.err)
      this.removeEventListener("DESTROY", future.err)
      this.removeEventListener("RELAY_EXTENDED2", future.ok)
    }
  }

  async extend(exit: boolean) {
    const fallback = randomOf(this.tor.fallbacks[exit ? "exits" : "middles"])

    if (!fallback)
      throw new Error("Can't find fallback")

    return await this._extend(fallback)
  }

  async _extend(fallback: Fallback) {
    const idh = Buffer.from(fallback.id, "hex")
    const eid = Buffer.from(fallback.eid, "base64")

    const links: Link[] = fallback.hosts.map(
      it => it.startsWith("[")
        ? LinkIPv6.from(it)
        : LinkIPv4.from(it))
    links.push(new LinkLegacyID(idh))
    links.push(new LinkModernID(eid))

    const xsecretx = new X25519StaticSecret()
    const publicx = Buffer.from(xsecretx.to_public().to_bytes().buffer)
    const publicb = Buffer.from(fallback.onion)

    const request = ntor.request(publicx, idh, publicb)

    const pextended2 = this.waitExtended()
    this.tor.send(await new RelayExtend2Cell(this, undefined, RelayExtend2Cell.types.NTOR, links, request).pack())
    const extended2 = await pextended2

    const response = ntor.response(extended2.data.data)

    const { publicy } = response
    const xpublicy = new X25519PublicKey(publicy)
    const xpublicb = new X25519PublicKey(publicb)

    const sharedxy = Buffer.from(xsecretx.diffie_hellman(xpublicy).to_bytes().buffer)
    const sharedxb = Buffer.from(xsecretx.diffie_hellman(xpublicb).to_bytes().buffer)

    const result = await ntor.finalize(sharedxy, sharedxb, idh, publicb, publicx, publicy)

    const forwardDigest = new Sha1Hasher()
    const backwardDigest = new Sha1Hasher()

    forwardDigest.update(result.forwardDigest)
    backwardDigest.update(result.backwardDigest)

    const forwardKey = new Aes128Ctr128BEKey(result.forwardKey, Buffer.alloc(16))
    const backwardKey = new Aes128Ctr128BEKey(result.backwardKey, Buffer.alloc(16))

    const target = new Target(idh, this, forwardDigest, backwardDigest, forwardKey, backwardKey)

    this.targets.push(target)
  }

  private async waitTruncated() {
    const future = new Future<Event, Event>()

    try {
      this.tor.tls.addEventListener("close", future.err, { passive: true })
      this.tor.tls.addEventListener("error", future.err, { passive: true })
      this.addEventListener("DESTROY", future.err, { passive: true })
      this.addEventListener("RELAY_TRUNCATED", future.ok, { passive: true })
      return await future.promise as MessageEvent<RelayTruncatedCell>
    } catch (e: unknown) {
      throw Events.error(e)
    } finally {
      this.tor.tls.removeEventListener("error", future.err)
      this.tor.tls.removeEventListener("close", future.err)
      this.removeEventListener("DESTROY", future.err)
      this.removeEventListener("RELAY_TRUNCATED", future.ok)
    }
  }

  async truncate(reason = RelayTruncateCell.reasons.NONE) {
    const ptruncated = this.waitTruncated()
    this.tor.send(await new RelayTruncateCell(this, undefined, reason).pack())
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
    this.tor.send(await new RelayBeginCell(this, stream, `${hostname}:${port}`, flags).pack())

    return stream
  }

  async fetch(input: RequestInfo, init?: RequestInit) {
    const req = new Request(input, init)
    const url = new URL(req.url)
    const port = Number(url.port) || 80

    const tcp = await this.open(url.hostname, port, req.signal)
    return await new HttpStream(tcp, req, url).res.promise
  }
}