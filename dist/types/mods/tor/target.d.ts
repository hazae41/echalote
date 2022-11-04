import { Sha1Hasher } from '@hazae41/morax';
import { Aes128Ctr128BEKey } from '@hazae41/zepar';
import { Circuit } from './circuit.js';

declare class Target {
    readonly idHash: Buffer;
    readonly circuit: Circuit;
    readonly forwardDigest: Sha1Hasher;
    readonly backwardDigest: Sha1Hasher;
    readonly forwardKey: Aes128Ctr128BEKey;
    readonly backwardKey: Aes128Ctr128BEKey;
    readonly class: typeof Target;
    constructor(idHash: Buffer, circuit: Circuit, forwardDigest: Sha1Hasher, backwardDigest: Sha1Hasher, forwardKey: Aes128Ctr128BEKey, backwardKey: Aes128Ctr128BEKey);
}

export { Target };
