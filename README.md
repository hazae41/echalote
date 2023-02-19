<div align="center">
<img src="https://user-images.githubusercontent.com/4405263/219942970-2b5fb519-7bbe-491a-a12b-6b71040febe4.png" />
</div>

```bash
npm i @hazae41/echalote
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/echalote) • [**Online Demo 🌐**](https://echalote-example-next.vercel.app) • [**Next.js CodeSandbox 🪣**](https://codesandbox.io/p/github/hazae41/echalote-example-next)

## DO NOT USE

This is experimental software in early development

1. It has security issues
2. Things change quickly

## Features

### Current features
- 100% TypeScript and ESM
- Zero-copy reading and writing
- Works in the browser
- All cryptography use either WebCrypto or reproducible WebAssembly ports of audited Rust implementations
- Partial and unsafe Tor protocol (with Ed25519, ntor, kdf-tor)
- Partial Meek (HTTP) transport (without domain-fronting)
- Partial Snowflake (WebRTC/WebSocket) transport (without domain-fronting)
- Partial and unsafe TLS using [Cadenas](https://github.com/hazae41/cadenas)
- Partial HTTP and WebSocket messaging using [Fleche](https://github.com/hazae41/fleche)

### [Upcoming features](https://github.com/sponsors/hazae41)
- Tor consensus and directories support

## Usage

```typescript
import { Tor, createWebSocketSnowflakeStream } from "@hazae41/echalote"
import fallbacks from "./fallbacks.json"

const tcp = await createWebSocketSnowflakeStream("wss://snowflake.bamsoftware.com/")

const tor = new Tor(tcp, { fallbacks })

const circuit = await tor.tryCreateAndExtend()
const res = await circuit.fetch("https://twitter.com")
const json = await res.json()
```