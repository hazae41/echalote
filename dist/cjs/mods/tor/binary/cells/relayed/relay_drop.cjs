'use strict';

var tslib = require('tslib');
var relay = require('../direct/relay.cjs');

class RelayDropCell {
    constructor(circuit, stream, data) {
        this.circuit = circuit;
        this.stream = stream;
        this.data = data;
        this.class = RelayDropCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        return new relay.RelayCell(this.circuit, this.stream, this.class.rcommand, this.data);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new Error(`Invalid RELAY_DROP relay cell relay command`);
        return new this(cell.circuit, cell.stream, cell.data);
    }
}
RelayDropCell.rcommand = 10;

exports.RelayDropCell = RelayDropCell;
//# sourceMappingURL=relay_drop.cjs.map
