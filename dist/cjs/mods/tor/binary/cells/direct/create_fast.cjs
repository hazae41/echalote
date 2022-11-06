'use strict';

var binary = require('../../../../../libs/binary.cjs');
var cell = require('../cell.cjs');
var errors = require('../errors.cjs');
var constants = require('../../../constants.cjs');

class CreateFastCell {
    /**
     * The CREATE_FAST cell
     * @param material Key material (X) [20]
     */
    constructor(circuit, material) {
        this.circuit = circuit;
        this.material = material;
        this.class = CreateFastCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        if (this.material.length !== 20)
            throw new Error(`Invalid ${this.class.name} material length`);
        binary$1.write(this.material);
        binary$1.fill();
        return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new errors.InvalidCommand(this.name, cell.command);
        if (!cell.circuit)
            throw new errors.InvalidCircuit(this.name, cell.circuit);
        const binary$1 = new binary.Binary(cell.payload);
        const material = binary$1.read(20);
        return new this(cell.circuit, material);
    }
}
CreateFastCell.command = 5;

exports.CreateFastCell = CreateFastCell;
//# sourceMappingURL=create_fast.cjs.map
