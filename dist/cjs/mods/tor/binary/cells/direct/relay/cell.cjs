'use strict';

var tslib = require('tslib');
var array = require('../../../../../../libs/array.cjs');
var binary = require('../../../../../../libs/binary.cjs');
var cell = require('../../cell.cjs');
var errors = require('../../errors.cjs');
var constants = require('../../../../constants.cjs');

class RelayCell {
    constructor(circuit, stream, rcommand, data) {
        this.circuit = circuit;
        this.stream = stream;
        this.rcommand = rcommand;
        this.data = data;
        this.class = RelayCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return (yield this.cell()).pack();
        });
    }
    cell() {
        var _a, _b;
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
            binary$1.writeUint8(this.rcommand);
            binary$1.writeUint16(0);
            binary$1.writeUint16((_b = (_a = this.stream) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 0);
            const digestOffset = binary$1.offset;
            binary$1.writeUint32(0);
            binary$1.writeUint16(this.data.length);
            binary$1.write(this.data);
            binary$1.fill(Math.min(binary$1.remaining, 4));
            if (binary$1.remaining > 0) {
                const random = Buffer.allocUnsafe(binary$1.remaining);
                binary$1.write(crypto.getRandomValues(random));
            }
            const exit = array.lastOf(this.circuit.targets);
            exit.forwardDigest.update(binary$1.buffer);
            const fullDigest = Buffer.from(exit.forwardDigest.finalize().buffer);
            const digest = fullDigest.subarray(0, 4);
            binary$1.offset = digestOffset;
            binary$1.write(digest);
            for (let i = this.circuit.targets.length - 1; i >= 0; i--)
                this.circuit.targets[i].forwardKey.apply_keystream(binary$1.buffer);
            return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
        });
    }
    static uncell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (cell.command !== this.command)
                throw new errors.InvalidCommand(this.name, cell.command);
            if (!cell.circuit)
                throw new errors.InvalidCircuit(this.name, cell.circuit);
            for (let i = 0; i < cell.circuit.targets.length; i++)
                cell.circuit.targets[i].backwardKey.apply_keystream(cell.payload);
            const binary$1 = new binary.Binary(cell.payload);
            const rcommand = binary$1.readUint8();
            const recognised = binary$1.readUint16();
            if (recognised !== 0)
                throw new Error(`Unrecognised ${this.name}`);
            const streamId = binary$1.readUint16();
            const stream = streamId
                ? cell.circuit.streams.get(streamId)
                : undefined;
            if (streamId && !stream)
                throw new Error(`Unknown stream id ${streamId}`);
            binary$1.read(4); // TODO 
            const length = binary$1.readUint16();
            const data = binary$1.read(length);
            return new this(cell.circuit, stream, rcommand, data);
        });
    }
}
RelayCell.command = 3;

exports.RelayCell = RelayCell;
//# sourceMappingURL=cell.cjs.map
