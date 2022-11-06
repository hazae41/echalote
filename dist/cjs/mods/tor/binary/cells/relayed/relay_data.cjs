'use strict';

var tslib = require('tslib');
var cell = require('../direct/relay/cell.cjs');
var errors = require('../errors.cjs');

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
        return new cell.RelayCell(this.circuit, this.stream, this.class.rcommand, this.data);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new errors.InvalidRelayCommand(this.name, cell.rcommand);
        if (!cell.stream)
            throw new errors.InvalidStream(this.name, cell.stream);
        return new this(cell.circuit, cell.stream, cell.data);
    }
}
RelayDataCell.rcommand = 2;

exports.RelayDataCell = RelayDataCell;
//# sourceMappingURL=relay_data.cjs.map
