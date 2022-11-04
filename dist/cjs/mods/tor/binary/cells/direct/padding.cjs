'use strict';

var cell = require('../cell.cjs');
var constants = require('../../../constants.cjs');

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
            throw new Error(`Invalid PADDING cell command ${cell.command}`);
        return new this(cell.circuit, cell.payload);
    }
}
PaddingCell.command = 0;

exports.PaddingCell = PaddingCell;
//# sourceMappingURL=padding.cjs.map
