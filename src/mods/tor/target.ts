import { Sha1Hasher } from "@hazae41/morax";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { Circuit } from "mods/tor/circuit.js";

export class Target {
  readonly #class = Target

  constructor(
    readonly idHash: Buffer,
    readonly circuit: Circuit,
    readonly forwardDigest: Sha1Hasher,
    readonly backwardDigest: Sha1Hasher,
    readonly forwardKey: Aes128Ctr128BEKey,
    readonly backwardKey: Aes128Ctr128BEKey
  ) { }

}
