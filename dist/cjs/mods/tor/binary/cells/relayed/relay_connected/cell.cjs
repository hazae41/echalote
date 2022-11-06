'use strict';

var tslib = require('tslib');
var binary = require('../../../../../../libs/binary.cjs');
var time = require('../../../../../../libs/time.cjs');
var address = require('../../../address.cjs');
var errors = require('../../errors.cjs');

class RelayConnectedCell {
    constructor(circuit, stream, address, ttl) {
        this.circuit = circuit;
        this.stream = stream;
        this.address = address;
        this.ttl = ttl;
        this.class = RelayConnectedCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        throw new Error(`Unimplemented`);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new errors.InvalidRelayCommand(this.name, cell.rcommand);
        if (!cell.stream)
            throw new errors.InvalidStream(this.name, cell.stream);
        const binary$1 = new binary.Binary(cell.data);
        const ipv4 = address.Address4.read(binary$1);
        if (ipv4.address !== "...") {
            const ttl = time.ttlToDate(binary$1.readUint32());
            return new this(cell.circuit, cell.stream, ipv4, ttl);
        }
        const type = binary$1.readUint8();
        if (type !== 6)
            throw new Error(`Unknown address type ${type}`);
        const ipv6 = address.Address6.read(binary$1);
        const ttl = time.ttlToDate(binary$1.readUint32());
        return new this(cell.circuit, cell.stream, ipv6, ttl);
    }
}
RelayConnectedCell.rcommand = 4;

exports.RelayConnectedCell = RelayConnectedCell;
//# sourceMappingURL=cell.cjs.map
