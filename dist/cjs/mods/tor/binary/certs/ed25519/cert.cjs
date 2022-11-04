'use strict';

var signer = require('./extensions/signer.cjs');

class Cert {
    constructor(type, version, certType, expiration, certKeyType, certKey, extensions, payload, signature) {
        this.type = type;
        this.version = version;
        this.certType = certType;
        this.expiration = expiration;
        this.certKeyType = certKeyType;
        this.certKey = certKey;
        this.extensions = extensions;
        this.payload = payload;
        this.signature = signature;
        this.class = Cert;
    }
    write(binary) {
        throw new Error(`Unimplemented`);
    }
    check() {
        const now = new Date();
        if (now > this.expiration)
            throw new Error(`Late certificate`);
        if (this.extensions.signer)
            this.extensions.signer.check(this);
    }
    static read(binary, type, length) {
        const start = binary.offset;
        const version = binary.readUint8();
        const certType = binary.readUint8();
        const expDateHours = binary.readUint32();
        const expiration = new Date(expDateHours * 60 * 60 * 1000);
        const certKeyType = binary.readUint8();
        const certKey = binary.read(32);
        const nextensions = binary.readUint8();
        const extensions = {};
        for (let i = 0; i < nextensions; i++) {
            const length = binary.readUint16();
            const type = binary.readUint8();
            const flags = binary.readUint8();
            if (type === signer.SignedWithEd25519Key.type) {
                extensions.signer = signer.SignedWithEd25519Key.read(binary, length, flags);
                continue;
            }
            if (flags === this.flags.AFFECTS_VALIDATION)
                throw new Error(`Unknown Ed25519 cert extension type ${type}`);
            else
                binary.read(length);
        }
        const payload = binary.reread(start);
        const signature = binary.read(64);
        if (binary.offset - start !== length)
            throw new Error(`Invalid Ed25519 cert length ${length}`);
        return new this(type, version, certType, expiration, certKeyType, certKey, extensions, payload, signature);
    }
}
Cert.types = {
    EID_TO_SIGNING: 4,
    SIGNING_TO_TLS: 5,
    SIGNING_TO_AUTH: 6,
};
Cert.flags = {
    AFFECTS_VALIDATION: 1
};

exports.Cert = Cert;
//# sourceMappingURL=cert.cjs.map
