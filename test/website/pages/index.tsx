import { AES_256_CBC, BatchedFetchStream, Cipher, Ciphers, DHE_RSA, SHA, TlsStream, WebSocketStream } from "@hazae41/cadenas";
import { Circuit, Tor } from "@hazae41/echalote";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { DependencyList, useCallback, useEffect, useState } from "react";

lorem;

export function randomOf<T>(array: T[]): T | undefined {
  return array[Math.floor(Math.random() * array.length)]
}

async function createWebSocketStream(url: string) {
  const websocket = new WebSocket(url)

  websocket.binaryType = "arraybuffer"

  await new Promise((ok, err) => {
    websocket.addEventListener("open", ok)
    websocket.addEventListener("error", err)
  })

  return new WebSocketStream(websocket)
}

async function createHttpStream() {
  const headers = { "x-session-id": crypto.randomUUID() }
  const request = new Request("https://meek.bamsoftware.com/", { headers })

  return new BatchedFetchStream(request)
}

async function createTor(tls: ReadableWritablePair<Uint8Array>) {
  const tor = new Tor(tls, {})

  await tor.init()

  return tor
}

async function extendMiddle(circuit: Circuit) {
  while (true)
    try {
      const middle = randomOf(fallbacks)!

      console.log("middle", middle.id)
      await circuit._extend(middle)

      return
    } catch (e: unknown) {
      console.warn(e)
    }
}

async function extendExit(circuit: Circuit) {
  while (true)
    try {
      const exit = randomOf(fallbacks.filter(it => it.exit))!

      console.log("exit", exit.id)
      await circuit._extend(exit)

      return
    } catch (e: unknown) {
      console.warn(e)
    }
}

async function createCircuit(tor: Tor) {
  while (true)
    try {
      const circuit = await tor.create()

      await extendMiddle(circuit)
      await extendExit(circuit)
      // await circuit.fetch("https://google.com")

      return circuit
    } catch (e: unknown) {
      console.warn(e)
    }
}

function useAsyncMemo<T>(factory: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<T>()

  useEffect(() => {
    factory().then(setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export const fixedCiphersuites = {
  TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA: 0xc00a,
  TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA: 0xc014,
  TLS_DHE_DSS_WITH_AES_256_CBC_SHA: 0x0038,
  TLS_ECDH_RSA_WITH_AES_256_CBC_SHA: 0xc00f,
  TLS_ECDH_ECDSA_WITH_AES_256_CBC_SHA: 0xc005,
  TLS_RSA_WITH_AES_256_CBC_SHA: 0x0035,
  TLS_ECDHE_ECDSA_WITH_RC4_128_SHA: 0xc007,
  TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA: 0xc009,
  TLS_ECDH_RSA_WITH_RC4_128_SHA: 0xc00c,
  TLS_ECDH_RSA_WITH_AES_128_CBC_SHA: 0xc00e,
  TLS_DHE_RSA_WITH_AES_128_CBC_SHA: 0x0033,
  TLS_DHE_DSS_WITH_AES_128_CBC_SHA: 0x0032,
  TLS_ECDHE_RSA_WITH_RC4_128_SHA: 0xc011,
  TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA: 0xc013,
  TLS_ECDH_ECDSA_WITH_RC4_128_SHA: 0xc002,
  TLS_ECDH_ECDSA_WITH_AES_128_CBC_SHA: 0xc004,
  TLS_RSA_WITH_RC4_128_MD5: 0x0004,
  TLS_RSA_WITH_RC4_128_SHA: 0x0005,
  TLS_RSA_WITH_AES_128_CBC_SHA: 0x002f,
  TLS_ECDHE_ECDSA_WITH_3DES_EDE_CBC_SHA: 0xc008,
  TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA: 0xc012,
  TLS_DHE_RSA_WITH_3DES_EDE_CBC_SHA: 0x0016,
  TLS_DHE_DSS_WITH_3DES_EDE_CBC_SHA: 0x0013,
  TLS_ECDH_RSA_WITH_3DES_EDE_CBC_SHA: 0xc00d,
  TLS_ECDH_ECDSA_WITH_3DES_EDE_CBC_SHA: 0xc003,
  SSL_RSA_FIPS_WITH_3DES_EDE_CBC_SHA: 0xfeff,
  TLS_RSA_WITH_3DES_EDE_CBC_SHA: 0x000a,
}

export default function Page() {
  const tls = useAsyncMemo(async () => {
    const xxx = await createWebSocketStream("ws://localhost:8080")

    const fakes = Object.values(fixedCiphersuites).map(code => new Cipher(code, DHE_RSA, AES_256_CBC, SHA))
    const ciphers = [Ciphers.TLS_DHE_RSA_WITH_AES_256_CBC_SHA, ...fakes]
    const tls = new TlsStream(xxx, { ciphers })

    await tls.handshake()

    return tls
  }, [])

  const tor = useAsyncMemo(async () => {
    if (!tls) return

    const tor = new Tor(tls)

    await tor.init()
    await tor.handshake()

    return tor
  }, [tls])

  const onClick = useCallback(async () => {
    try {
      if (!tor) return

      const circuit = await createCircuit(tor)

      const res = await circuit.fetch("https://7.tcp.eu.ngrok.io:12680")

      console.log(res)
      console.log(await res.text())
    } catch (e: unknown) {
      console.error(e)
    }
  }, [tor])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}