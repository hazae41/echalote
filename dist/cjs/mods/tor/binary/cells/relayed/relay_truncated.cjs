'use strict';

var tslib = require('tslib');
var binary = require('../../../../../libs/binary.cjs');
var cell$1 = require('../direct/destroy/cell.cjs');
var cell = require('../direct/relay/cell.cjs');
var errors = require('../errors.cjs');

class RelayTruncatedCell {
    constructor(circuit, stream, reason) {
        this.circuit = circuit;
        this.stream = stream;
        this.reason = reason;
        this.class = RelayTruncatedCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(1);
        binary$1.writeUint8(this.reason);
        return new cell.RelayCell(this.circuit, this.stream, this.class.rcommand, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new errors.InvalidRelayCommand(this.name, cell.rcommand);
        if (cell.stream)
            throw new errors.InvalidStream(this.name, cell.stream);
        const binary$1 = new binary.Binary(cell.data);
        const reason = binary$1.readUint8();
        return new this(cell.circuit, cell.stream, reason);
    }
}
RelayTruncatedCell.rcommand = 9;
RelayTruncatedCell.reasons = cell$1.DestroyCell.reasons;

exports.RelayTruncatedCell = RelayTruncatedCell;
//# sourceMappingURL=relay_truncated.cjs.map
