'use strict';

var tslib = require('tslib');
var relay = require('../direct/relay.cjs');

class RelayDataCell {
    constructor(circuit, stream, data) {
        this.circuit = circuit;
        this.stream = stream;
        this.data = data;
        this.class = RelayDataCell;
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
            throw new Error(`Invalid RELAY_DATA relay cell relay command`);
        if (!cell.stream)
            throw new Error(`Can't uncell RELAY_DATA relay cell on stream 0`);
        return new this(cell.circuit, cell.stream, cell.data);
    }
}
RelayDataCell.rcommand = 2;

exports.RelayDataCell = RelayDataCell;
//# sourceMappingURL=relay_data.cjs.map
