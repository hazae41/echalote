'use strict';

var binary = require('../../../../../libs/binary.cjs');
var cell = require('../cell.cjs');
var errors = require('../errors.cjs');
var constants = require('../../../constants.cjs');

class Create2Cell {
    constructor(circuit, type, data) {
        this.circuit = circuit;
        this.type = type;
        this.data = data;
        this.class = Create2Cell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint16(this.type);
        binary$1.writeUint16(this.data.length);
        binary$1.write(this.data);
        binary$1.fill();
        return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new errors.InvalidCommand(this.name, cell.command);
        if (!cell.circuit)
            throw new errors.InvalidCircuit(this.name, cell.circuit);
        const binary$1 = new binary.Binary(cell.payload);
        const type = binary$1.readUint16();
        const length = binary$1.readUint16();
        const data = binary$1.read(length);
        return new this(cell.circuit, type, data);
    }
}
Create2Cell.command = 10;
Create2Cell.types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
};

exports.Create2Cell = Create2Cell;
//# sourceMappingURL=create2.cjs.map
