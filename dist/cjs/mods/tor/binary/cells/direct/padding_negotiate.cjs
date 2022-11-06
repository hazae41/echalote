'use strict';

var binary = require('../../../../../libs/binary.cjs');
var cell = require('../cell.cjs');
var errors = require('../errors.cjs');
var constants = require('../../../constants.cjs');

class PaddingNegociateCell {
    constructor(circuit, version, pcommand, ito_low_ms, ito_high_ms) {
        this.circuit = circuit;
        this.version = version;
        this.pcommand = pcommand;
        this.ito_low_ms = ito_low_ms;
        this.ito_high_ms = ito_high_ms;
        this.class = PaddingNegociateCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint8(this.version);
        binary$1.writeUint8(this.pcommand);
        binary$1.writeUint16(this.ito_low_ms);
        binary$1.writeUint16(this.ito_high_ms);
        binary$1.fill();
        return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new errors.InvalidCommand(this.name, cell.command);
        if (cell.circuit)
            throw new errors.InvalidCircuit(this.name, cell.circuit);
        const binary$1 = new binary.Binary(cell.payload);
        const version = binary$1.readUint8();
        const pcommand = binary$1.readUint8();
        const ito_low_ms = binary$1.readUint16();
        const ito_high_ms = binary$1.readUint16();
        return new this(cell.circuit, version, pcommand, ito_low_ms, ito_high_ms);
    }
}
PaddingNegociateCell.command = 12;
PaddingNegociateCell.versions = {
    ZERO: 0
};
PaddingNegociateCell.commands = {
    STOP: 1,
    START: 2
};

exports.PaddingNegociateCell = PaddingNegociateCell;
//# sourceMappingURL=padding_negotiate.cjs.map
