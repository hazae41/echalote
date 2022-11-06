'use strict';

var tslib = require('tslib');
var binary = require('../../../../../../libs/binary.cjs');
var cell = require('../../direct/relay/cell.cjs');
var errors = require('../../errors.cjs');
var reason = require('./reason.cjs');
var constants = require('../../../../constants.cjs');

class RelayEndCell {
    constructor(circuit, stream, reason) {
        this.circuit = circuit;
        this.stream = stream;
        this.reason = reason;
        this.class = RelayEndCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint8(this.reason.id);
        this.reason.write(binary$1);
        return new cell.RelayCell(this.circuit, this.stream, this.class.rcommand, binary$1.sliced);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new errors.InvalidRelayCommand(this.name, cell.rcommand);
        if (!cell.stream)
            throw new errors.InvalidStream(this.name, cell.stream);
        const binary$1 = new binary.Binary(cell.data);
        const reasonId = binary$1.readUint8();
        const reason$1 = reasonId === this.reasons.REASON_EXITPOLICY
            ? reason.RelayEndReasonExitPolicy.read(binary$1)
            : new reason.RelayEndReasonOther(reasonId);
        return new this(cell.circuit, cell.stream, reason$1);
    }
}
RelayEndCell.rcommand = 3;
RelayEndCell.reasons = {
    REASON_UNKNOWN: 0,
    REASON_MISC: 1,
    REASON_RESOLVEFAILED: 2,
    REASON_CONNECTREFUSED: 3,
    REASON_EXITPOLICY: 4,
    REASON_DESTROY: 5,
    REASON_DONE: 6,
    REASON_TIMEOUT: 7,
    REASON_NOROUTE: 8,
    REASON_HIBERNATING: 9,
    REASON_INTERNAL: 10,
    REASON_RESOURCELIMIT: 11,
    REASON_CONNRESET: 12,
    REASON_TORPROTOCOL: 13,
    REASON_NOTDIRECTORY: 14,
};

exports.RelayEndCell = RelayEndCell;
//# sourceMappingURL=cell.cjs.map
