'use strict';

class RelayExtend2LinkIPv4 {
    constructor(hostname, port) {
        this.hostname = hostname;
        this.port = port;
        this.class = RelayExtend2LinkIPv4;
    }
    write(binary) {
        binary.writeUint8(this.class.type);
        binary.writeUint8(4 + 2);
        const [a, b, c, d] = this.hostname.split(".");
        binary.writeUint8(Number(a));
        binary.writeUint8(Number(b));
        binary.writeUint8(Number(c));
        binary.writeUint8(Number(d));
        binary.writeUint16(this.port);
    }
    static from(host) {
        const { hostname, port } = new URL(`http://${host}`);
        return new this(hostname, Number(port));
    }
}
RelayExtend2LinkIPv4.type = 0;
class RelayExtend2LinkIPv6 {
    constructor(hostname, port) {
        this.hostname = hostname;
        this.port = port;
        this.class = RelayExtend2LinkIPv6;
    }
    write(binary) {
        binary.writeUint8(this.class.type);
        binary.writeUint8(16 + 2);
        const [a, b, c, d, e, f, g, h] = this.hostname.split(":");
        binary.writeUint16(Number(`0x${a}`) || 0);
        binary.writeUint16(Number(`0x${b}`) || 0);
        binary.writeUint16(Number(`0x${c}`) || 0);
        binary.writeUint16(Number(`0x${d}`) || 0);
        binary.writeUint16(Number(`0x${e}`) || 0);
        binary.writeUint16(Number(`0x${f}`) || 0);
        binary.writeUint16(Number(`0x${g}`) || 0);
        binary.writeUint16(Number(`0x${h}`) || 0);
        binary.writeUint16(this.port);
    }
    static from(host) {
        const { hostname, port } = new URL(`http://${host}`);
        return new this(hostname.slice(1, -1), Number(port));
    }
}
RelayExtend2LinkIPv6.type = 1;
class RelayExtend2LinkLegacyID {
    constructor(fingerprint) {
        this.fingerprint = fingerprint;
        this.class = RelayExtend2LinkLegacyID;
    }
    write(binary) {
        binary.writeUint8(this.class.type);
        binary.writeUint8(20);
        binary.write(this.fingerprint);
    }
}
RelayExtend2LinkLegacyID.type = 2;
class RelayExtend2LinkModernID {
    constructor(fingerprint) {
        this.fingerprint = fingerprint;
        this.class = RelayExtend2LinkModernID;
    }
    write(binary) {
        binary.writeUint8(this.class.type);
        binary.writeUint8(32);
        binary.write(this.fingerprint);
    }
}
RelayExtend2LinkModernID.type = 3;

exports.RelayExtend2LinkIPv4 = RelayExtend2LinkIPv4;
exports.RelayExtend2LinkIPv6 = RelayExtend2LinkIPv6;
exports.RelayExtend2LinkLegacyID = RelayExtend2LinkLegacyID;
exports.RelayExtend2LinkModernID = RelayExtend2LinkModernID;
//# sourceMappingURL=link.cjs.map
