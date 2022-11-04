'use strict';

var binary = require('../../../../../libs/binary.cjs');
var cell = require('../cell.cjs');
var constants = require('../../../constants.cjs');

class CreatedFastCell {
    constructor(circuit, material, derivative) {
        this.circuit = circuit;
        this.material = material;
        this.derivative = derivative;
        this.class = CreatedFastCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.write(this.material);
        binary$1.write(this.derivative);
        binary$1.fill();
        return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new Error(`Invalid CREATED_FAST cell command ${cell.command}`);
        if (!cell.circuit)
            throw new Error(`Can't uncell CREATED_FAST cell on circuit 0`);
        const binary$1 = new binary.Binary(cell.payload);
        const material = binary$1.read(20);
        const derivative = binary$1.read(20);
        return new this(cell.circuit, material, derivative);
    }
}
CreatedFastCell.command = 6;

exports.CreatedFastCell = CreatedFastCell;
//# sourceMappingURL=created_fast.cjs.map
