'use strict';

var tslib = require('tslib');
var binary = require('../../../../../libs/binary.cjs');
var destroy = require('../direct/destroy.cjs');
var relay = require('../direct/relay.cjs');

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
        return new relay.RelayCell(this.circuit, this.stream, this.class.rcommand, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new Error(`Invalid RELAY_TRUNCATED relay cell relay command`);
        if (cell.stream)
            throw new Error(`Can't uncell RELAY_TRUNCATED relay cell on stream > 0`);
        const binary$1 = new binary.Binary(cell.data);
        const reason = binary$1.readUint8();
        return new this(cell.circuit, cell.stream, reason);
    }
}
RelayTruncatedCell.rcommand = 9;
RelayTruncatedCell.reasons = destroy.DestroyCell.reasons;

exports.RelayTruncatedCell = RelayTruncatedCell;
//# sourceMappingURL=relay_truncated.cjs.map
