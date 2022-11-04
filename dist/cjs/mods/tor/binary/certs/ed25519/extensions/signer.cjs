'use strict';

var berith = require('@hazae41/berith');

class SignedWithEd25519Key {
    constructor(length, flags, key) {
        this.length = length;
        this.flags = flags;
        this.key = key;
        this.class = SignedWithEd25519Key;
    }
    get type() {
        return this.class.type;
    }
    check(cert) {
        const identity = new berith.Ed25519PublicKey(this.key);
        const signature = new berith.Ed25519Signature(cert.signature);
        const verified = identity.verify(cert.payload, signature);
        if (!verified)
            throw new Error(`Invalid signer for Ed25519 Cert`);
    }
    write(binary) {
        throw new Error(`Unimplemented`);
    }
    static read(binary, length, flags) {
        const start = binary.offset;
        const key = binary.read(32);
        if (binary.offset - start !== length)
            throw new Error(`Invalid Ed25519 cert extension SignedWithEd25519Key length ${length}`);
        return new this(length, flags, key);
    }
}
SignedWithEd25519Key.type = 4;

exports.SignedWithEd25519Key = SignedWithEd25519Key;
//# sourceMappingURL=signer.cjs.map
