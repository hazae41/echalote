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
- Works in the browser
- Partial Meek (TCP-over-HTTP) transport (without domain-fronting)
- Partial and unsafe Tor protocol (with Ed25519, ntor, kdf-tor)
- Partial and unsafe TLS using [Cadenas](https://github.com/hazae41/cadenas)
- Partial HTTP messaging using [Fleche](https://github.com/hazae41/fleche)
- All cryptography use either WebCrypto or reproducible WebAssembly ports of audited Rust implementations

### [Upcoming features](https://github.com/sponsors/hazae41)
- Tor consensus and directories support
- Implementation of TLS for HTTP (which becomes HTTPS)
- Snowflake (TCP-over-WebRTC) transport
