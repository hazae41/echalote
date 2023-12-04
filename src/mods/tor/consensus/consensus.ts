import { ASN1 } from "@hazae41/asn1"
import { Base16 } from "@hazae41/base16"
import { Base64 } from "@hazae41/base64"
import { Bytes } from "@hazae41/bytes"
import { fetch } from "@hazae41/fleche"
import { Paimon } from "@hazae41/paimon"
import { Catched, Result } from "@hazae41/result"
import { OIDs, X509 } from "@hazae41/x509"
import { Mutable } from "libs/typescript/typescript.js"
import { Circuit } from "../circuit.js"

export interface Consensus {
  readonly type: string
  readonly version: number
  readonly status: string
  readonly method: number
  readonly validAfter: Date
  readonly freshUntil: Date
  readonly votingDelay: [number, number]
  readonly clientVersions: string[]
  readonly serverVersions: string[]
  readonly knownFlags: string[]
  readonly recommendedClientProtocols: Record<string, string>
  readonly recommendedRelayProtocols: Record<string, string>
  readonly requiredClientProtocols: Record<string, string>
  readonly requiredRelayProtocols: Record<string, string>
  readonly params: Record<string, string>
  readonly sharedRandPreviousValue: Consensus.SharedRandom
  readonly sharedRandCurrentValue: Consensus.SharedRandom
  readonly authorities: Consensus.Authority[]
  readonly microdescs: Consensus.Microdesc.Head[]
  readonly bandwidthWeights: Record<string, string>

  readonly preimage: string
  readonly signatures: Consensus.Signature[]
}

export namespace Consensus {

  export interface SharedRandom {
    readonly reveals: number
    readonly random: string
  }

  export interface Authority {
    readonly nickname: string
    readonly identity: string
    readonly hostname: string
    readonly ipaddress: string
    readonly dirport: number
    readonly orport: number
    readonly contact: string
    readonly digest: string
  }

  export namespace Authority {

    export const trusteds = new Set([
      "0232AF901C31A04EE9848595AF9BB7620D4C5B2E",
      "14C131DFC5C6F93646BE72FA1401C02A8DF2E8B4",
      "23D15D965BC35114467363C165C4F724B64B4F66",
      "27102BC123E7AF1D4741AE047E160C91ADC76B21",
      "49015F787433103580E3B66A1707A00E60F2D15B",
      "E8A9C45EDE6D711294FADF8E7951F4DE6CA56B58",
      "ED03BB616EB2F60BEC80151114BB25CEF515B226",
      "F533C81CEF0BC0267857C99B2F471ADF249FA232"
    ])

  }

  export interface Signature {
    readonly algorithm: string
    readonly identity: string
    readonly signingKeyDigest: string
    readonly signature: string
  }

  export async function tryFetch(circuit: Circuit): Promise<Result<Consensus, Error>> {
    return await Result.runAndWrap(async () => {
      return await fetchOrThrow(circuit)
    }).then(r => r.mapErrSync(Catched.from))
  }

  export async function fetchOrThrow(circuit: Circuit) {
    const stream = await circuit.openDirOrThrow()
    const response = await fetch(`http://localhost/tor/status-vote/current/consensus-microdesc.z`, { stream: stream.outer })
    const consensus = Consensus.parseOrThrow(await response.text())

    if (await Consensus.verifyOrThrow(circuit, consensus) !== true)
      throw new Error(`Could not verify`)

    return consensus
  }

  export function parseOrThrow(text: string) {
    const lines = text.split("\n")

    const consensus: Partial<Mutable<Consensus>> = {}

    const authorities: Authority[] = []
    const microdescs: Microdesc.Head[] = []
    const signatures: Signature[] = []

    for (const i = { x: 0 }; i.x < lines.length; i.x++) {

      if (lines[i.x].startsWith("network-status-version ")) {
        const [, version, type] = lines[i.x].split(" ")
        consensus.version = Number(version)
        consensus.type = type
        continue
      }

      if (lines[i.x].startsWith("vote-status ")) {
        const [, status] = lines[i.x].split(" ")
        consensus.status = status
        continue
      }

      if (lines[i.x].startsWith("consensus-method ")) {
        const [, method] = lines[i.x].split(" ")
        consensus.method = Number(method)
        continue
      }

      if (lines[i.x].startsWith("valid-after ")) {
        const validAfter = lines[i.x].split(" ").slice(1).join(" ")
        consensus.validAfter = new Date(validAfter)
        continue
      }

      if (lines[i.x].startsWith("fresh-until ")) {
        const freshUntil = lines[i.x].split(" ").slice(1).join(" ")
        consensus.freshUntil = new Date(freshUntil)
        continue
      }

      if (lines[i.x].startsWith("voting-delay ")) {
        const [, first, second] = lines[i.x].split(" ")
        consensus.votingDelay = [Number(first), Number(second)]
        continue
      }

      if (lines[i.x].startsWith("client-versions ")) {
        const [, versions] = lines[i.x].split(" ")
        consensus.clientVersions = versions.split(",")
        continue
      }

      if (lines[i.x].startsWith("server-versions ")) {
        const [, versions] = lines[i.x].split(" ")
        consensus.serverVersions = versions.split(",")
        continue
      }

      if (lines[i.x].startsWith("known-flags ")) {
        const [, ...flags] = lines[i.x].split(" ")
        consensus.knownFlags = flags
        continue
      }

      if (lines[i.x].startsWith("recommended-client-protocols ")) {
        const [, ...protocols] = lines[i.x].split(" ")
        consensus.recommendedClientProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (lines[i.x].startsWith("recommended-relay-protocols ")) {
        const [, ...protocols] = lines[i.x].split(" ")
        consensus.recommendedRelayProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (lines[i.x].startsWith("required-client-protocols ")) {
        const [, ...protocols] = lines[i.x].split(" ")
        consensus.requiredClientProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (lines[i.x].startsWith("required-relay-protocols ")) {
        const [, ...protocols] = lines[i.x].split(" ")
        consensus.requiredRelayProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (lines[i.x].startsWith("params ")) {
        const [, ...params] = lines[i.x].split(" ")
        consensus.params = Object.fromEntries(params.map(entry => entry.split("=")))
        continue
      }

      if (lines[i.x].startsWith("shared-rand-previous-value ")) {
        const [, reveals, random] = lines[i.x].split(" ")
        consensus.sharedRandPreviousValue = { reveals: Number(reveals), random }
        continue
      }

      if (lines[i.x].startsWith("shared-rand-current-value ")) {
        const [, reveals, random] = lines[i.x].split(" ")
        consensus.sharedRandCurrentValue = { reveals: Number(reveals), random }
        continue
      }

      if (lines[i.x] === "directory-footer") {
        for (i.x++; i.x < lines.length; i.x++) {

          if (lines[i.x].startsWith("bandwidth-weights ")) {
            const [, ...weights] = lines[i.x].split(" ")
            consensus.bandwidthWeights = Object.fromEntries(weights.map(entry => entry.split("=")))
            continue
          }

          if (lines[i.x].startsWith("directory-signature ")) {
            consensus.preimage ??= `${lines.slice(0, i.x).join("\n")}\ndirectory-signature `

            const item: Partial<Mutable<Consensus.Signature>> = {}
            const [, algorithm, identity, signingKeyDigest] = lines[i.x].split(" ")
            item.algorithm = algorithm
            item.identity = identity
            item.signingKeyDigest = signingKeyDigest

            i.x++

            item.signature = readSignatureOrThrow(lines, i)

            if (item.algorithm == null)
              throw new Error("Missing algorithm")
            if (item.identity == null)
              throw new Error("Missing identity")
            if (item.signingKeyDigest == null)
              throw new Error("Missing signingKeyDigest")
            if (item.signature == null)
              throw new Error("Missing signature")

            const signature = item as Consensus.Signature
            signatures.push(signature)
            continue
          }

          continue
        }

        break
      }

      if (lines[i.x].startsWith("dir-source ")) {
        const item: Partial<Mutable<Authority>> = {}
        const [_, nickname, identity, hostname, ipaddress, dirport, orport] = lines[i.x].split(" ")
        item.nickname = nickname
        item.identity = identity
        item.hostname = hostname
        item.ipaddress = ipaddress
        item.dirport = Number(dirport)
        item.orport = Number(orport)

        for (i.x++; i.x < lines.length; i.x++) {
          if (lines[i.x].startsWith("dir-source ")) {
            i.x--
            break
          }

          if (lines[i.x].startsWith("r ")) {
            i.x--
            break
          }

          if (lines[i.x] === "directory-footer") {
            i.x--
            break
          }

          if (lines[i.x].startsWith("contact ")) {
            const contact = lines[i.x].split(" ").slice(1).join(" ")
            item.contact = contact
            continue
          }

          if (lines[i.x].startsWith("vote-digest ")) {
            const [_, digest] = lines[i.x].split(" ")
            item.digest = digest
            continue
          }

          continue
        }

        if (item.nickname == null)
          throw new Error("Missing nickname")
        if (item.identity == null)
          throw new Error("Missing identity")
        if (item.hostname == null)
          throw new Error("Missing hostname")
        if (item.ipaddress == null)
          throw new Error("Missing ipaddress")
        if (item.dirport == null)
          throw new Error("Missing dirport")
        if (item.orport == null)
          throw new Error("Missing orport")
        if (item.contact == null)
          throw new Error("Missing contact")
        if (item.digest == null)
          throw new Error("Missing digest")

        const authority = item as Authority
        authorities.push(authority)
        continue
      }

      if (lines[i.x].startsWith("r ")) {
        const item: Partial<Mutable<Microdesc.Head>> = {}

        const [_, nickname, identity, date, hour, hostname, orport, dirport] = lines[i.x].split(" ")
        item.nickname = nickname
        item.identity = identity
        item.date = date
        item.hour = hour
        item.hostname = hostname
        item.orport = Number(orport)
        item.dirport = Number(dirport)

        for (i.x++; i.x < lines.length; i.x++) {
          if (lines[i.x].startsWith("dir-source ")) {
            i.x--
            break
          }

          if (lines[i.x].startsWith("r ")) {
            i.x--
            break
          }

          if (lines[i.x] === "directory-footer") {
            i.x--
            break
          }

          if (lines[i.x].startsWith("a ")) {
            const [, ipv6] = lines[i.x].split(" ")
            item.ipv6 = ipv6
            continue
          }

          if (lines[i.x].startsWith("m ")) {
            const [, digest] = lines[i.x].split(" ")
            item.microdesc = digest
            continue
          }

          if (lines[i.x].startsWith("s ")) {
            const [, ...flags] = lines[i.x].split(" ")
            item.flags = flags
            continue
          }

          if (lines[i.x].startsWith("v ")) {
            const version = lines[i.x].slice("v ".length)
            item.version = version
            continue
          }

          if (lines[i.x].startsWith("pr ")) {
            const [, ...entries] = lines[i.x].split(" ")
            item.entries = Object.fromEntries(entries.map(entry => entry.split("=")))
            continue
          }

          if (lines[i.x].startsWith("w ")) {
            const [, ...entries] = lines[i.x].split(" ")
            item.bandwidth = Object.fromEntries(entries.map(entry => entry.split("=")))
            continue
          }

          continue
        }

        if (item.nickname == null)
          throw new Error("Missing nickname")
        if (item.identity == null)
          throw new Error("Missing identity")
        if (item.date == null)
          throw new Error("Missing date")
        if (item.hour == null)
          throw new Error("Missing hour")
        if (item.hostname == null)
          throw new Error("Missing hostname")
        if (item.orport == null)
          throw new Error("Missing orport")
        if (item.dirport == null)
          throw new Error("Missing dirport")
        if (item.microdesc == null)
          throw new Error("Missing microdesc")
        if (item.flags == null)
          throw new Error("Missing flags")
        if (item.version == null)
          throw new Error("Missing version")
        if (item.entries == null)
          throw new Error("Missing entries")
        if (item.bandwidth == null)
          throw new Error("Missing bandwidth")

        microdescs.push(item as Microdesc.Head)
        continue
      }

      continue
    }

    consensus.authorities = authorities
    consensus.microdescs = microdescs
    consensus.signatures = signatures
    return consensus as Consensus
  }

  export async function verifyOrThrow(circuit: Circuit, consensus: Consensus) {
    let count = 0

    for (const it of consensus.signatures) {
      if (it.algorithm === "sha256") {
        if (!Authority.trusteds.has(it.identity))
          continue

        const certificate = await Certificate.fetchOrThrow(circuit, it.identity)

        if (certificate == null)
          throw new Error(`Missing certificate for ${it.identity}`)

        const signed = Bytes.fromUtf8(consensus.preimage)
        const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", signed))

        using signingKey = Base64.get().decodePaddedOrThrow(certificate.signingKey)

        const algorithmAsn1 = ASN1.ObjectIdentifier.create(undefined, OIDs.keys.rsaEncryption).toDER()
        const algorithmId = new X509.AlgorithmIdentifier(algorithmAsn1, ASN1.Null.create().toDER())
        const subjectPublicKey = ASN1.BitString.create(undefined, 0, signingKey.bytes).toDER()
        const subjectPublicKeyInfo = new X509.SubjectPublicKeyInfo(algorithmId, subjectPublicKey)

        const publicKey = X509.writeToBytesOrThrow(subjectPublicKeyInfo)

        using signature = Base64.get().decodePaddedOrThrow(it.signature)

        using signatureM = new Paimon.Memory(signature.bytes)
        using hashedM = new Paimon.Memory(hashed)
        using publicKeyM = new Paimon.Memory(publicKey)

        using publicKeyX = Paimon.RsaPublicKey.from_public_key_der(publicKeyM)
        const verified = publicKeyX.verify_pkcs1v15_unprefixed(hashedM, signatureM)

        if (verified !== true)
          throw new Error(`Could not verify`)

        count++

        continue
      }

      continue
    }

    if (count < 3)
      throw new Error(`Not enough signatures`)

    return true
  }

  export interface Certificate {
    readonly version: number
    readonly fingerprint: string
    readonly published: Date
    readonly expires: Date
    readonly identityKey: string
    readonly signingKey: string
    readonly crossCert: string

    readonly preimage: string
    readonly signature: string
  }

  export namespace Certificate {

    export async function fetchAllOrThrow(circuit: Circuit) {
      const stream = await circuit.openDirOrThrow()
      const response = await fetch(`http://localhost/tor/keys/fp/all.z`, { stream: stream.outer })

      if (!response.ok)
        throw new Error(`Could not fetch`)

      const certificates = parseOrThrow(await response.text())

      const verifieds = await Promise.all(certificates.map(verifyOrThrow))

      if (verifieds.some(result => result !== true))
        throw new Error(`Could not verify`)

      return certificates
    }

    export async function fetchOrThrow(circuit: Circuit, fingerprint: string) {
      const stream = await circuit.openDirOrThrow()
      const response = await fetch(`http://localhost/tor/keys/fp/${fingerprint}.z`, { stream: stream.outer })

      if (!response.ok)
        throw new Error(`Could not fetch`)

      const [certificate] = parseOrThrow(await response.text())

      if (certificate == null)
        throw new Error(`Missing certificate`)

      if (await verifyOrThrow(certificate) !== true)
        throw new Error(`Could not verify`)

      return certificate
    }

    export async function verifyOrThrow(cert: Certificate) {
      await Paimon.initBundledOnce()

      using identityKey = Base64.get().decodePaddedOrThrow(cert.identityKey)

      const identity = new Uint8Array(await crypto.subtle.digest("SHA-1", identityKey.bytes))
      const fingerprint = Base16.get().encodeOrThrow(identity)

      if (fingerprint.toLowerCase() !== cert.fingerprint.toLowerCase())
        throw new Error(`Fingerprint mismatch`)

      const signed = Bytes.fromUtf8(cert.preimage)
      const hashed = new Uint8Array(await crypto.subtle.digest("SHA-1", signed))

      const algorithmAsn1 = ASN1.ObjectIdentifier.create(undefined, OIDs.keys.rsaEncryption).toDER()
      const algorithmId = new X509.AlgorithmIdentifier(algorithmAsn1, ASN1.Null.create().toDER())
      const subjectPublicKey = ASN1.BitString.create(undefined, 0, identityKey.bytes).toDER()
      const subjectPublicKeyInfo = new X509.SubjectPublicKeyInfo(algorithmId, subjectPublicKey)

      const publicKey = X509.writeToBytesOrThrow(subjectPublicKeyInfo)

      using signature = Base64.get().decodePaddedOrThrow(cert.signature)

      using hashedM = new Paimon.Memory(hashed)
      using publicKeyM = new Paimon.Memory(publicKey)
      using signatureM = new Paimon.Memory(signature.bytes)

      using publicKeyX = Paimon.RsaPublicKey.from_public_key_der(publicKeyM)
      const verified = publicKeyX.verify_pkcs1v15_unprefixed(hashedM, signatureM)

      if (verified !== true)
        throw new Error(`Could not verify`)

      return true
    }

    export function parseOrThrow(text: string) {
      const lines = text.split("\n")

      const items: Certificate[] = []

      for (const i = { x: 0 }; i.x < lines.length; i.x++) {
        if (lines[i.x].startsWith("dir-key-certificate-version ")) {
          const start = i.x

          const cert: Partial<Mutable<Certificate>> = {}

          const [, version] = lines[i.x].split(" ")
          cert.version = Number(version)

          for (i.x++; i.x < lines.length; i.x++) {
            if (lines[i.x].startsWith("dir-key-certificate-version ")) {
              i.x--
              break
            }

            if (lines[i.x].startsWith("fingerprint ")) {
              const [, fingerprint] = lines[i.x].split(" ")
              cert.fingerprint = fingerprint
              continue
            }

            if (lines[i.x].startsWith("dir-key-published ")) {
              const published = lines[i.x].split(" ").slice(1).join(" ")
              cert.published = new Date(published)
              continue
            }

            if (lines[i.x].startsWith("dir-key-expires ")) {
              const expires = lines[i.x].split(" ").slice(1).join(" ")
              cert.expires = new Date(expires)
              continue
            }

            if (lines[i.x] === "dir-identity-key") {
              i.x++

              cert.identityKey = readRsaPublicKeyOrThrow(lines, i)
              continue
            }

            if (lines[i.x] === "dir-signing-key") {
              i.x++

              cert.signingKey = readRsaPublicKeyOrThrow(lines, i)
              continue
            }

            if (lines[i.x] === "dir-key-crosscert") {
              i.x++

              cert.crossCert = readIdSignatureOrThrow(lines, i)
              continue
            }

            if (lines[i.x] === "dir-key-certification") {
              i.x++
              cert.preimage = lines.slice(start, i.x).join("\n") + "\n"
              cert.signature = readSignatureOrThrow(lines, i)
              continue
            }

            continue
          }

          if (cert.version == null)
            throw new Error("Missing version")
          if (cert.fingerprint == null)
            throw new Error("Missing fingerprint")
          if (cert.published == null)
            throw new Error("Missing published")
          if (cert.expires == null)
            throw new Error("Missing expires")
          if (cert.identityKey == null)
            throw new Error("Missing identityKey")
          if (cert.signingKey == null)
            throw new Error("Missing signingKey")
          if (cert.crossCert == null)
            throw new Error("Missing crossCert")
          if (cert.signature == null)
            throw new Error("Missing certification")

          items.push(cert as Certificate)
          continue
        }

        continue
      }

      return items
    }

  }

  export type Microdesc =
    & Microdesc.Head
    & Microdesc.Body

  export namespace Microdesc {

    export interface Head {
      readonly nickname: string
      readonly identity: string
      readonly date: string
      readonly hour: string
      readonly hostname: string
      readonly orport: number
      readonly dirport: number
      readonly ipv6?: string
      readonly microdesc: string
      readonly flags: string[]
      readonly version: string
      readonly entries: Record<string, string>
      readonly bandwidth: Record<string, string>
    }

    export interface Body {
      readonly onionKey: string
      readonly ntorOnionKey: string
      readonly idEd25519: string
    }

    export async function tryFetch(circuit: Circuit, ref: Head): Promise<Result<Microdesc, Error>> {
      return await Result.runAndWrap(async () => {
        return await fetchOrThrow(circuit, ref)
      }).then(r => r.mapErrSync(Catched.from))
    }

    export async function fetchOrThrow(circuit: Circuit, ref: Head) {
      const stream = await circuit.openDirOrThrow()
      const response = await fetch(`http://localhost/tor/micro/d/${ref.microdesc}.z`, { stream: stream.outer })

      if (!response.ok)
        throw new Error(`Could not fetch ${response.status} ${response.statusText}: ${await response.text()}`)

      const buffer = await response.arrayBuffer()
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))

      const digest64 = Base64.get().encodePaddedOrThrow(digest)

      if (digest64 !== ref.microdesc)
        throw new Error(`Digest mismatch`)

      const text = Bytes.toUtf8(new Uint8Array(buffer))
      const [data] = parseOrThrow(text)

      if (data == null)
        throw new Error(`Empty microdescriptor`)

      return { ...ref, ...data } as Microdesc
    }

    export function parseOrThrow(text: string) {
      const lines = text.split("\n")

      const items: Body[] = []

      for (const i = { x: 0 }; i.x < lines.length; i.x++) {
        if (lines[i.x] === "onion-key") {
          i.x++

          const item: Partial<Mutable<Body>> = {}
          item.onionKey = readRsaPublicKeyOrThrow(lines, i)

          for (i.x++; i.x < lines.length; i.x++) {
            if (lines[i.x] === "onion-key") {
              i.x--
              break
            }

            if (lines[i.x].startsWith("ntor-onion-key ")) {
              const [, ntorOnionKey] = lines[i.x].split(" ")
              item.ntorOnionKey = ntorOnionKey
              continue
            }

            if (lines[i.x].startsWith("id ed25519 ")) {
              const [, , idEd25519] = lines[i.x].split(" ")
              item.idEd25519 = idEd25519
              continue
            }

            continue
          }

          if (item.onionKey == null)
            throw new Error("Missing onion-key")
          if (item.ntorOnionKey == null)
            throw new Error("Missing ntor-onion-key")
          if (item.idEd25519 == null)
            throw new Error("Missing id ed25519")

          items.push(item as Body)
          continue
        }

        continue
      }

      return items
    }

  }

}

function readRsaPublicKeyOrThrow(lines: string[], i: { x: number }) {
  if (lines[i.x] !== "-----BEGIN RSA PUBLIC KEY-----")
    throw new Error("Missing BEGIN RSA PUBLIC KEY")

  let text = ""

  for (i.x++; i.x < lines.length; i.x++) {
    if (lines[i.x] === "-----END RSA PUBLIC KEY-----")
      return text
    text += lines[i.x]
  }

  throw new Error("Missing END RSA PUBLIC KEY")
}

function readSignatureOrThrow(lines: string[], i: { x: number }) {
  if (lines[i.x] !== "-----BEGIN SIGNATURE-----")
    throw new Error("Missing BEGIN SIGNATURE")

  let text = ""

  for (i.x++; i.x < lines.length; i.x++) {
    if (lines[i.x] === "-----END SIGNATURE-----")
      return text
    text += lines[i.x]
  }

  throw new Error("Missing END SIGNATURE")
}

function readIdSignatureOrThrow(lines: string[], i: { x: number }) {
  if (lines[i.x] !== "-----BEGIN ID SIGNATURE-----")
    throw new Error("Missing BEGIN ID SIGNATURE")

  let text = ""

  for (i.x++; i.x < lines.length; i.x++) {
    if (lines[i.x] === "-----END ID SIGNATURE-----")
      return text
    text += lines[i.x]
  }

  throw new Error("Missing END ID SIGNATURE")
}