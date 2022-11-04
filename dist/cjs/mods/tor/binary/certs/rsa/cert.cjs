'use strict';

var x509 = require('@peculiar/x509');

class Cert {
    constructor(type, data, cert) {
        this.type = type;
        this.data = data;
        this.cert = cert;
        this.class = Cert;
    }
    write(binary) {
        binary.writeUint8(this.type);
        binary.writeUint16(this.data.length);
        binary.write(this.data);
    }
    check() {
        const now = new Date();
        if (now > this.cert.notAfter)
            throw new Error(`Late certificate`);
        if (now < this.cert.notBefore)
            throw new Error(`Early certificate`);
    }
    static read(binary, type, length) {
        const start = binary.offset;
        const data = binary.read(length);
        const cert = new x509.X509Certificate(data);
        if (binary.offset - start !== length)
            throw new Error(`Invalid RSA cert length ${length}`);
        return new this(type, data, cert);
    }
}
Cert.types = {
    ID: 2,
    ID_TO_TLS: 1,
    ID_TO_AUTH: 3
};

exports.Cert = Cert;
//# sourceMappingURL=cert.cjs.map
