'use strict';

var tslib = require('tslib');
var binary = require('../../../../../libs/binary.cjs');
var bits = require('../../../../../libs/bits.cjs');
var relay = require('../direct/relay.cjs');
var constants = require('../../../constants.cjs');

class RelayBeginCell {
    constructor(circuit, stream, address, flags) {
        this.circuit = circuit;
        this.stream = stream;
        this.address = address;
        this.flags = flags;
        this.class = RelayBeginCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeNullString(this.address);
        binary$1.writeUint32(this.flags.n);
        binary$1.fill();
        return new relay.RelayCell(this.circuit, this.stream, this.class.rcommand, binary$1.sliced);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new Error(`Invalid RELAY_BEGIN relay cell relay command`);
        if (!cell.stream)
            throw new Error(`Can't uncell RELAY_BEGIN relay cell on stream 0`);
        const binary$1 = new binary.Binary(cell.data);
        const address = binary$1.readNullString();
        const flagsn = binary$1.readUint32();
        const flags = new bits.Bitmask(flagsn);
        return new this(cell.circuit, cell.stream, address, flags);
    }
}
RelayBeginCell.rcommand = 1;
RelayBeginCell.flags = {
    IPV4_OK: 0,
    IPV6_NOT_OK: 1,
    IPV6_PREFER: 2
};

exports.RelayBeginCell = RelayBeginCell;
//# sourceMappingURL=relay_begin.cjs.map
