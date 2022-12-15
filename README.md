<p align="center">
<img width="500" src="https://user-images.githubusercontent.com/4405263/207913604-117b1ea2-5e17-4a1b-a97e-2a7a4fdf7a07.png" />
</p>

**DO NOT USE: Although it works well, it is still very unsafe to use, even for MVP purpose, as not all Tor features are implemented, TLS is not implemented yet, and it uses Meek without domain-fronting**

### Current features
- 100% TypeScript and ESM
- Zero-copy buffering and parsing
- All crypto use either WebCrypto or reproducible WebAssembly ports of audited Rust implementations
- Unsafe TLS with modified node-forge (thanks to node-tor)
- Partial Meek transport support without domain-fronting
- Partial Tor protocol support with Ed25519, ntor, kdf-tor
- Partial HTTP1.1 using WebStreams with support for chunked transfer and gzip compression
- Support for Chromium and Safari (Firefox needs to fix its WebStreams implementation)

### Upcoming features
- Tor consensus and directories support
- Implementation of TLS for both Tor and HTTP (which becomes HTTPS)
- Snowflake transport support
- More HTTP1.1 features
- HTTP2, HTTP3 (QUIC)
