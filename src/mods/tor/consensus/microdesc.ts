import { Mutable } from "libs/typescript/typescript.js"

export namespace Microdescs {

  export interface Item {
    readonly nickname: string
    readonly identity: string
    readonly date: string
    readonly hour: string
    readonly hostname: string
    readonly orport: string
    readonly dirport: string
    readonly ipv6?: string
    readonly microdesc: string
    readonly flags: string[]
    readonly version: string
    readonly entries: Record<string, string>
    readonly bandwidth: Record<string, string>
  }

  export function parseOrThrow(text: string) {
    const lines = text.split("\n")

    const items: Item[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (!line.startsWith("r "))
        continue

      const item: Partial<Mutable<Item>> = {}

      const [_, nickname, identity, date, hour, hostname, orport, dirport] = line.split(" ")
      item.nickname = nickname
      item.identity = identity
      item.date = date
      item.hour = hour
      item.hostname = hostname
      item.orport = orport
      item.dirport = dirport

      for (let j = i + 1; j < lines.length; j++, i++) {
        const line = lines[j]

        if (line.startsWith("r "))
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

      items.push(item as Item)
    }

    return items
  }

}

export namespace Microdesc {

  export interface Item {
    readonly onionKey: string
    readonly ntorOnionKey: string
    readonly idEd25519?: string
  }

  export function parseOrThrow(text: string) {
    const lines = text.split("\n")

    const items: Item[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (!line.startsWith("onion-key"))
        continue

      const item: Partial<Mutable<Item>> = {}

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

      items.push(item as Item)
    }

    return items
  }

}