'use strict';

var cell = require('../../cell.cjs');
var errors = require('../../errors.cjs');
var constants = require('../../../../constants.cjs');

class VariablePaddingCell {
    constructor(circuit, data = Buffer.alloc(constants.PAYLOAD_LEN)) {
        this.circuit = circuit;
        this.data = data;
        this.class = VariablePaddingCell;
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
VariablePaddingCell.command = 128;

exports.VariablePaddingCell = VariablePaddingCell;
//# sourceMappingURL=cell.cjs.map
