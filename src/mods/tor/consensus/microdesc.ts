import { Mutable } from "libs/typescript/typescript.js"

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
  readonly microdescs: Microdesc.Pre[]
  readonly bandwidthWeights: Record<string, string>
  readonly signatures: Consensus.Signature[]
  readonly preimage: string
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

  export interface Signature {
    readonly algorithm: string
    readonly identity: string
    readonly signingKeyDigest: string
    readonly signature: string
  }

  export function parseOrThrow(text: string) {
    const lines = text.split("\n")

    const consensus: Partial<Mutable<Consensus>> = {}

    const authorities: Authority[] = []
    const microdescs: Microdesc.Pre[] = []
    const signatures: Signature[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith("network-status-version ")) {
        const [, version, type] = line.split(" ")
        consensus.version = Number(version)
        consensus.type = type
        continue
      }

      if (line.startsWith("vote-status ")) {
        const [, status] = line.split(" ")
        consensus.status = status
        continue
      }

      if (line.startsWith("consensus-method ")) {
        const [, method] = line.split(" ")
        consensus.method = Number(method)
        continue
      }

      if (line.startsWith("valid-after ")) {
        const validAfter = line.split(" ").slice(1).join(" ")
        consensus.validAfter = new Date(validAfter)
        continue
      }

      if (line.startsWith("fresh-until ")) {
        const freshUntil = line.split(" ").slice(1).join(" ")
        consensus.freshUntil = new Date(freshUntil)
        continue
      }

      if (line.startsWith("voting-delay ")) {
        const [, first, second] = line.split(" ")
        consensus.votingDelay = [Number(first), Number(second)]
        continue
      }

      if (line.startsWith("client-versions ")) {
        const [, versions] = line.split(" ")
        consensus.clientVersions = versions.split(",")
        continue
      }

      if (line.startsWith("server-versions ")) {
        const [, versions] = line.split(" ")
        consensus.serverVersions = versions.split(",")
        continue
      }

      if (line.startsWith("known-flags ")) {
        const [, ...flags] = line.split(" ")
        consensus.knownFlags = flags
        continue
      }

      if (line.startsWith("recommended-client-protocols ")) {
        const [, ...protocols] = line.split(" ")
        consensus.recommendedClientProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (line.startsWith("recommended-relay-protocols ")) {
        const [, ...protocols] = line.split(" ")
        consensus.recommendedRelayProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (line.startsWith("required-client-protocols ")) {
        const [, ...protocols] = line.split(" ")
        consensus.requiredClientProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (line.startsWith("required-relay-protocols ")) {
        const [, ...protocols] = line.split(" ")
        consensus.requiredRelayProtocols = Object.fromEntries(protocols.map(entry => entry.split("=")))
        continue
      }

      if (line.startsWith("params ")) {
        const [, ...params] = line.split(" ")
        consensus.params = Object.fromEntries(params.map(entry => entry.split("=")))
        continue
      }

      if (line.startsWith("shared-rand-previous-value ")) {
        const [, reveals, random] = line.split(" ")
        consensus.sharedRandPreviousValue = { reveals: Number(reveals), random }
        continue
      }

      if (line.startsWith("shared-rand-current-value ")) {
        const [, reveals, random] = line.split(" ")
        consensus.sharedRandCurrentValue = { reveals: Number(reveals), random }
        continue
      }

      if (line.startsWith("directory-footer")) {

        for (let j = i + 1; j < lines.length; j++, i++) {
          const line = lines[j]

          if (line.startsWith("bandwidth-weights ")) {
            const [, ...weights] = line.split(" ")
            consensus.bandwidthWeights = Object.fromEntries(weights.map(entry => entry.split("=")))
            continue
          }

          if (line.startsWith("directory-signature ")) {
            if (consensus.preimage == null)
              consensus.preimage = `${lines.slice(0, j).join("\n")}\ndirectory-signature `

            const item: Partial<Mutable<Consensus.Signature>> = {}
            const [, algorithm, identity, signingKeyDigest] = line.split(" ")
            item.algorithm = algorithm
            item.identity = identity
            item.signingKeyDigest = signingKeyDigest
            item.signature = parseSignatureOrThrow()

            function parseSignatureOrThrow() {
              j++, i++;

              const line = lines[j]

              if (!line.startsWith("-----BEGIN SIGNATURE-----"))
                throw new Error("Missing signature")

              let signature = ""

              for (let g = j + 1; g < lines.length; g++, j++, i++) {
                const line = lines[g]

                if (line.startsWith("-----END SIGNATURE-----"))
                  return signature
                signature += line
              }

              throw new Error("Missing signature")
            }

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

      if (line.startsWith("dir-source ")) {
        const item: Partial<Mutable<Authority>> = {}
        const [_, nickname, identity, hostname, ipaddress, dirport, orport] = line.split(" ")
        item.nickname = nickname
        item.identity = identity
        item.hostname = hostname
        item.ipaddress = ipaddress
        item.dirport = Number(dirport)
        item.orport = Number(orport)

        for (let j = i + 1; j < lines.length; j++, i++) {
          const line = lines[j]

          if (line.startsWith("dir-source "))
            break
          if (line.startsWith("r "))
            break

          if (line.startsWith("contact ")) {
            const contact = line.split(" ").slice(1).join(" ")
            item.contact = contact
            continue
          }

          if (line.startsWith("vote-digest ")) {
            const [_, digest] = line.split(" ")
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

      if (line.startsWith("r ")) {
        const item: Partial<Mutable<Microdesc.Pre>> = {}

        const [_, nickname, identity, date, hour, hostname, orport, dirport] = line.split(" ")
        item.nickname = nickname
        item.identity = identity
        item.date = date
        item.hour = hour
        item.hostname = hostname
        item.orport = Number(orport)
        item.dirport = Number(dirport)

        for (let j = i + 1; j < lines.length; j++, i++) {
          const line = lines[j]

          if (line.startsWith("r "))
            break
          if (line.startsWith("directory-footer"))
            break

          if (line.startsWith("a ")) {
            const [, ipv6] = line.split(" ")
            item.ipv6 = ipv6
            continue
          }

          if (line.startsWith("m ")) {
            const [, digest] = line.split(" ")
            item.microdesc = digest
            continue
          }

          if (line.startsWith("s ")) {
            const [, ...flags] = line.split(" ")
            item.flags = flags
            continue
          }

          if (line.startsWith("v ")) {
            const version = line.slice("v ".length)
            item.version = version
            continue
          }

          if (line.startsWith("pr ")) {
            const [, ...entries] = line.split(" ")
            item.entries = Object.fromEntries(entries.map(entry => entry.split("=")))
            continue
          }

          if (line.startsWith("w ")) {
            const [, ...entries] = line.split(" ")
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

        microdescs.push(item as Microdesc.Pre)
        continue
      }

    }

    consensus.authorities = authorities
    consensus.microdescs = microdescs
    consensus.signatures = signatures
    return consensus as Consensus
  }

}

export type Microdesc =
  & Microdesc.Pre
  & Microdesc.Post

export namespace Microdesc {

  export interface Pre {
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

  export interface Post {
    readonly onionKey: string
    readonly ntorOnionKey: string
    readonly idEd25519: string
  }

  export function parseOrThrow(text: string) {
    const lines = text.split("\n")

    const items: Post[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (!line.startsWith("onion-key"))
        continue

      const item: Partial<Mutable<Post>> = {}

      let onionKey = ""

      for (let j = i + 1; j < lines.length; j++, i++) {
        const line = lines[j]

        if (line.startsWith("ntor-onion-key "))
          break
        onionKey += line
      }

      item.onionKey = onionKey

      for (let j = i + 1; j < lines.length; j++, i++) {
        const line = lines[j]

        if (line.startsWith("onion-key"))
          break

        if (line.startsWith("ntor-onion-key ")) {
          const [, ntorOnionKey] = line.split(" ")
          item.ntorOnionKey = ntorOnionKey
          continue
        }

        if (line.startsWith("id ed25519 ")) {
          const [, , idEd25519] = line.split(" ")
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

      items.push(item as Post)
    }

    return items
  }

}