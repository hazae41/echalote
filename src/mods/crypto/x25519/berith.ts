import type { Berith } from "@hazae41/berith"
import { Adapter } from "./x25519.js"

export function fromBerith(berith: typeof Berith): Adapter {
  const PublicKey = berith.X25519PublicKey
  const StaticSecret = berith.X25519StaticSecret

  return { PublicKey, StaticSecret }
}