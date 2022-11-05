# Tor in the browser

**DO NOT USE: Although it works well, it is still very unsafe to use, even for MVP purpose, as not all Tor security features are implemented, and TLS is not yet implemented, and it uses Meek without domain-fronting**

### Current features
- 100% TypeScript and ESM
- Zero-copy buffering and parsing
- All crypto use either WebCrypto or reproducible WebAssembly ports of audited Rust implementations
- Unsafe TLS with modified node-forge (thanks to node-tor)
- Partial Meek transport support without domain-fronting
- Partial Tor protocol support with Ed25519, ntor, kdf-tor
- Partial HTTP1.1 using WebStreams with support for chunked transfer and gzip compression

### Upcoming features
- Tor consensus and directories support
- More HTTP1.1 features
- Implementation of TLS for both Tor and HTTP (which becomes HTTPS)
- Snowflake transport support
- HTTP2, HTTP3 (QUIC)