'use strict';

var cell = require('../cell.cjs');
var constants = require('../../../constants.cjs');

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
            throw new Error(`Invalid VPADDING cell command ${cell.command}`);
        return new this(cell.circuit, cell.payload);
    }
}
VariablePaddingCell.command = 128;

exports.VariablePaddingCell = VariablePaddingCell;
//# sourceMappingURL=vpadding.cjs.map
