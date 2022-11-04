'use strict';

class Cert {
    constructor(type, key, expiration, payload, signature) {
        this.type = type;
        this.key = key;
        this.expiration = expiration;
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
    }
    static read(binary, type, length) {
        const start = binary.offset;
        const key = binary.read(32);
        const expDateHours = binary.readUint32();
        const expiration = new Date(expDateHours * 60 * 60 * 1000);
        const payload = binary.reread(start);
        const sigLength = binary.readUint8();
        const signature = binary.read(sigLength);
        if (binary.offset - start !== length)
            throw new Error(`Invalid Cross cert length ${length}`);
        return new this(type, key, expiration, payload, signature);
    }
}
Cert.types = {
    ID_TO_EID: 7
};

exports.Cert = Cert;
//# sourceMappingURL=cert.cjs.map
