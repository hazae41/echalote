'use strict';

var cell = require('../../cell.cjs');
var errors = require('../../errors.cjs');
var constants = require('../../../../constants.cjs');

class PaddingCell {
    constructor(circuit, data = Buffer.alloc(constants.PAYLOAD_LEN)) {
        this.circuit = circuit;
        this.data = data;
        this.class = PaddingCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        return new cell.NewCell(this.circuit, this.class.command, this.data);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new errors.InvalidCommand(this.name, cell.command);
        if (cell.circuit)
            throw new errors.InvalidCircuit(this.name, cell.circuit);
        return new this(cell.circuit, cell.payload);
    }
}
PaddingCell.command = 0;

exports.PaddingCell = PaddingCell;
//# sourceMappingURL=cell.cjs.map
