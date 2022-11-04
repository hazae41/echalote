'use strict';

var binary = require('../../../../libs/binary.cjs');
var constants = require('../../constants.cjs');

class OldCell {
    constructor(circuit, command, payload) {
        this.circuit = circuit;
        this.command = command;
        this.payload = payload;
        this.class = OldCell;
    }
    pack() {
        var _a, _b;
        const binary$1 = binary.Binary.allocUnsafe(2 + 1 + 2 + this.payload.length);
        binary$1.writeUint16((_b = (_a = this.circuit) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 0);
        binary$1.writeUint8(this.command);
        binary$1.writeUint16(this.payload.length);
        binary$1.write(this.payload);
        return binary$1.buffer;
    }
    static tryRead(binary) {
        const start = binary.offset;
        try {
            const circuitId = binary.readUint16();
            const command = binary.readUint8();
            const length = command === 7
                ? binary.readUint16()
                : constants.PAYLOAD_LEN;
            const payload = binary.read(length);
            return { type: "old", circuitId, command, payload };
        }
        catch (e) {
            binary.offset = start;
        }
    }
    static unpack(tor, raw) {
        const { circuitId, command, payload } = raw;
        const circuit = circuitId
            ? tor.circuits.get(circuitId)
            : undefined;
        if (circuitId && !circuit)
            throw new Error(`Unknown circuit id ${circuitId}`);
        return new this(circuit, command, payload);
    }
}
class NewCell {
    constructor(circuit, command, payload) {
        this.circuit = circuit;
        this.command = command;
        this.payload = payload;
        this.class = NewCell;
    }
    pack() {
        var _a, _b, _c, _d;
        if (this.command >= 128) {
            const binary$1 = binary.Binary.allocUnsafe(4 + 1 + 2 + this.payload.length);
            binary$1.writeUint32((_b = (_a = this.circuit) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 0);
            binary$1.writeUint8(this.command);
            binary$1.writeUint16(this.payload.length);
            binary$1.write(this.payload);
            return binary$1.buffer;
        }
        else {
            const binary$1 = binary.Binary.allocUnsafe(4 + 1 + this.payload.length);
            binary$1.writeUint32((_d = (_c = this.circuit) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : 0);
            binary$1.writeUint8(this.command);
            binary$1.write(this.payload);
            return binary$1.buffer;
        }
    }
    static tryRead(binary) {
        const start = binary.offset;
        try {
            const circuitId = binary.readUint32();
            const command = binary.readUint8();
            const length = command >= 128
                ? binary.readUint16()
                : constants.PAYLOAD_LEN;
            const payload = binary.read(length);
            return { type: "new", circuitId, command, payload };
        }
        catch (e) {
            binary.offset = start;
        }
    }
    static unpack(tor, raw) {
        const { circuitId, command, payload } = raw;
        const circuit = circuitId
            ? tor.circuits.get(circuitId)
            : undefined;
        if (circuitId && !circuit)
            throw new Error(`Unknown circuit id ${circuitId}`);
        return new this(circuit, command, payload);
    }
}

exports.NewCell = NewCell;
exports.OldCell = OldCell;
//# sourceMappingURL=cell.cjs.map
