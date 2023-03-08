import { Sha1Hasher } from "@hazae41/morax";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { SecretCircuit } from "mods/tor/circuit.js";

export class Target {
  readonly #class = Target

  constructor(
    readonly relayid_rsa: Uint8Array,
    readonly circuit: SecretCircuit,
    readonly forward_digest: Sha1Hasher,
    readonly backward_digest: Sha1Hasher,
    readonly forward_key: Aes128Ctr128BEKey,
    readonly backward_key: Aes128Ctr128BEKey
  ) { }

}
