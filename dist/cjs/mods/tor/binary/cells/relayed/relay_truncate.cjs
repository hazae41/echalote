'use strict';

var tslib = require('tslib');
var binary = require('../../../../../libs/binary.cjs');
var destroy = require('../direct/destroy.cjs');
var relay = require('../direct/relay.cjs');
var errors = require('../errors.cjs');

class RelayTruncateCell {
    constructor(circuit, stream, reason) {
        this.circuit = circuit;
        this.stream = stream;
        this.reason = reason;
        this.class = RelayTruncateCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(1);
        binary$1.writeUint8(this.reason);
        return new relay.RelayCell(this.circuit, this.stream, this.class.rcommand, binary$1.buffer);
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
RelayTruncateCell.rcommand = 8;
RelayTruncateCell.reasons = destroy.DestroyCell.reasons;

exports.RelayTruncateCell = RelayTruncateCell;
//# sourceMappingURL=relay_truncate.cjs.map
