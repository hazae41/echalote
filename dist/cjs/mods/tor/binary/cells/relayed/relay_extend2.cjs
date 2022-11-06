'use strict';

var tslib = require('tslib');
var binary = require('../../../../../libs/binary.cjs');
var cell = require('../direct/relay_early/cell.cjs');
var constants = require('../../../constants.cjs');

class LinkIPv4 {
    constructor(hostname, port) {
        this.hostname = hostname;
        this.port = port;
        this.class = LinkIPv4;
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
LinkIPv4.type = 0;
class LinkIPv6 {
    constructor(hostname, port) {
        this.hostname = hostname;
        this.port = port;
        this.class = LinkIPv6;
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
LinkIPv6.type = 1;
class LinkLegacyID {
    constructor(fingerprint) {
        this.fingerprint = fingerprint;
        this.class = LinkLegacyID;
    }
    write(binary) {
        binary.writeUint8(this.class.type);
        binary.writeUint8(20);
        binary.write(this.fingerprint);
    }
}
LinkLegacyID.type = 2;
class LinkModernID {
    constructor(fingerprint) {
        this.fingerprint = fingerprint;
        this.class = LinkModernID;
    }
    write(binary) {
        binary.writeUint8(this.class.type);
        binary.writeUint8(32);
        binary.write(this.fingerprint);
    }
}
LinkModernID.type = 3;
class RelayExtend2Cell {
    constructor(circuit, stream, type, links, data) {
        this.circuit = circuit;
        this.stream = stream;
        this.type = type;
        this.links = links;
        this.data = data;
        this.class = RelayExtend2Cell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint8(this.links.length);
        for (const link of this.links)
            link.write(binary$1);
        binary$1.writeUint16(this.type);
        binary$1.writeUint16(this.data.length);
        binary$1.write(this.data);
        return new cell.RelayEarlyCell(this.circuit, this.stream, this.class.rcommand, binary$1.sliced);
    }
}
RelayExtend2Cell.rcommand = 14;
RelayExtend2Cell.types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
};

exports.LinkIPv4 = LinkIPv4;
exports.LinkIPv6 = LinkIPv6;
exports.LinkLegacyID = LinkLegacyID;
exports.LinkModernID = LinkModernID;
exports.RelayExtend2Cell = RelayExtend2Cell;
//# sourceMappingURL=relay_extend2.cjs.map
