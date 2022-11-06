'use strict';

var binary = require('../../../../../libs/binary.cjs');
var address = require('../../address.cjs');
var cell = require('../cell.cjs');
var errors = require('../errors.cjs');
var constants = require('../../../constants.cjs');

class NetinfoCell {
    constructor(circuit, time, other, owneds) {
        this.circuit = circuit;
        this.time = time;
        this.other = other;
        this.owneds = owneds;
        this.class = NetinfoCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint32(this.time);
        this.other.write(binary$1);
        binary$1.writeUint8(this.owneds.length);
        for (const owned of this.owneds)
            owned.write(binary$1);
        binary$1.fill();
        return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new errors.InvalidCommand(this.name, cell.command);
        if (cell.circuit)
            throw new errors.InvalidCircuit(this.name, cell.circuit);
        const binary$1 = new binary.Binary(cell.payload);
        const time = binary$1.readUint32();
        const other = address.TypedAddress.read(binary$1);
        const nowneds = binary$1.readUint8();
        const owneds = new Array(nowneds);
        for (let i = 0; i < nowneds; i++)
            owneds[i] = address.TypedAddress.read(binary$1);
        return new this(cell.circuit, time, other, owneds);
    }
}
NetinfoCell.command = 8;

exports.NetinfoCell = NetinfoCell;
//# sourceMappingURL=netinfo.cjs.map
