import type { Berith } from "@hazae41/berith"
import { Adapter } from "./ed25519.js"

export function fromBerith(berith: typeof Berith): Adapter {
  const PublicKey = berith.Ed25519PublicKey
  const Signature = berith.Ed25519Signature

  return { PublicKey, Signature }
}