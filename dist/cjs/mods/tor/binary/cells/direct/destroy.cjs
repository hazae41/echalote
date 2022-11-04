'use strict';

var binary = require('../../../../../libs/binary.cjs');
var cell = require('../cell.cjs');
var constants = require('../../../constants.cjs');

class DestroyCell {
    constructor(circuit, reason) {
        this.circuit = circuit;
        this.reason = reason;
        this.class = DestroyCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint8(this.reason);
        binary$1.fill();
        return new cell.NewCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new Error(`Invalid DESTROY cell command ${cell.command}`);
        if (!cell.circuit)
            throw new Error(`Can't uncell DESTROY cell on circuit 0`);
        const binary$1 = new binary.Binary(cell.payload);
        const code = binary$1.readUint8();
        return new this(cell.circuit, code);
    }
}
DestroyCell.command = 4;
DestroyCell.reasons = {
    NONE: 0,
    PROTOCOL: 1,
    INTERNAL: 2,
    REQUESTED: 3,
    HIBERNATING: 4,
    RESOURCELIMIT: 5,
    CONNECTFAILED: 6,
    OR_IDENTITY: 7,
    CHANNEL_CLOSED: 8,
    FINISHED: 9,
    TIMEOUT: 10,
    DESTROYED: 11,
    NOSUCHSERVICE: 12
};

exports.DestroyCell = DestroyCell;
//# sourceMappingURL=destroy.cjs.map
