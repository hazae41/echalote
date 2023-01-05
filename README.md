<div align="center">
<img width="500" src="https://user-images.githubusercontent.com/4405263/207923057-9a9fafcd-e097-447d-97b9-45c92e1f2962.png" />
</div>
<h3 align="center">
Zero-copy Tor protocol for the web 🏎️
</h3>

```bash
npm i @hazae41/echalote
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/echalote)

### DO NOT USE

This is experimental software in early development

1. It has security issues
2. Things change quickly

### Current features
- 100% TypeScript and ESM
- Zero-copy reading and writing
- All cryptography use either WebCrypto or reproducible WebAssembly ports of audited Rust implementations
- Unsafe TLS with modified node-forge (thanks to node-tor)
- Partial Meek transport support without domain-fronting
- Partial Tor protocol support with Ed25519, ntor, kdf-tor
- Partial HTTP1.1 using WebStreams with support for chunked transfer and gzip compression
- Support for Chromium and Safari (Firefox needs to fix its WebStreams implementation)

### [Upcoming features](https://github.com/sponsors/hazae41)
- Tor consensus and directories support
- Implementation of TLS for both Tor and HTTP (which becomes HTTPS)
- Snowflake transport support
- More HTTP1.1 features
- HTTP2, HTTP3 (QUIC)
