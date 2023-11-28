<div align="center">
<img src="https://user-images.githubusercontent.com/4405263/219942970-2b5fb519-7bbe-491a-a12b-6b71040febe4.png" />
</div>

```bash
npm i @hazae41/echalote
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/echalote) • [**Online Demo 🌐**](https://echalote-example-next.vercel.app) • [**Next.js CodeSandbox 🪣**](https://codesandbox.io/p/github/hazae41/echalote-example-next)

## Use at your own risk

This is experimental software in early development

1. It has security issues
2. Things change quickly

## Features

### Current features
- 100% TypeScript and ESM
- Zero-copy reading and writing
- Works in the browser
- All cryptography use either WebCrypto or reproducible WebAssembly ports of Rust implementations
- Unsafe Tor protocol (with Ed25519, ntor, kdf-tor)
- Meek (HTTP) transport (without domain-fronting)
- Snowflake (WebRTC/WebSocket) transport (without domain-fronting)
- Unsafe TLS using [Cadenas](https://github.com/hazae41/cadenas)
- HTTP and WebSocket messaging using [Fleche](https://github.com/hazae41/fleche)

### [Upcoming features](https://github.com/sponsors/hazae41)
- Better security

## Usage

```typescript
import { createWebSocketSnowflakeStream, TorClientDuplex, Consensus } from "@hazae41/echalote"
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"

const tcp = await createWebSocketSnowflakeStream("wss://snowflake.bamsoftware.com/")
const tor = new TorClientDuplex()

tcp.outer.readable.pipeTo(tor.inner.writable).catch(() => {})
tor.inner.readable.pipeTo(tcp.outer.writable).catch(() => {})

await tor.waitOrThrow()

using circuit = await tor.createOrThrow()
const consensus = await Consensus.fetchOrThrow(circuit)

const middles = consensus.microdescs.filter(it => true
  && it.flags.includes("Fast")
  && it.flags.includes("Stable")
  && it.flags.includes("V2Dir"))

const exits = consensus.microdescs.filter(it => true
  && it.flags.includes("Fast")
  && it.flags.includes("Stable")
  && it.flags.includes("Exit")
  && !it.flags.includes("BadExit"))

const middle = middles[Math.floor(Math.random() * middles.length)]
const middle2 = await Consensus.Microdesc.fetchOrThrow(circuit, middle)
await circuit.extendOrThrow(middle2, AbortSignal.timeout(5000))

const exit = exits[Math.floor(Math.random() * middles.length)]
const exit2 = await Consensus.Microdesc.fetchOrThrow(circuit, exit)
await circuit.extendOrThrow(exit2, AbortSignal.timeout(5000))

const ttcp = await circuit.openOrThrow("twitter.com", 443)

const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
const ttls = new TlsClientDuplex({ host_name: url.hostname, ciphers })

ttcp.outer.readable.pipeTo(ttls.inner.writable).catch(() => { })
ttls.inner.readable.pipeTo(ttcp.outer.writable).catch(() => { })

const response = await fetch("https://twitter.com", { stream: ttls.outer })
const text = await response.text()
```