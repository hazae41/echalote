import { Bytes } from "@hazae41/bytes";
import type { Sha1 } from "@hazae41/sha1";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { SecretCircuit } from "mods/tor/circuit.js";

export class Target {
  readonly #class = Target

  delivery = 1000
  package = 1000

  digests = new Array<Bytes<20>>()

  constructor(
    readonly relayid_rsa: Uint8Array,
    readonly circuit: SecretCircuit,
    readonly forward_digest: Sha1.Hasher,
    readonly backward_digest: Sha1.Hasher,
    readonly forward_key: Aes128Ctr128BEKey,
    readonly backward_key: Aes128Ctr128BEKey
  ) { }

}
