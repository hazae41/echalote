'use strict';

var tslib = require('tslib');
var binary = require('../../../../../../libs/binary.cjs');
var errors = require('../../errors.cjs');

class RelayExtended2Cell {
    constructor(circuit, stream, data) {
        this.circuit = circuit;
        this.stream = stream;
        this.data = data;
        this.class = RelayExtended2Cell;
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
        if (cell.stream)
            throw new errors.InvalidStream(this.name, cell.stream);
        const binary$1 = new binary.Binary(cell.data);
        const length = binary$1.readUint16();
        const data = binary$1.read(length);
        return new this(cell.circuit, cell.stream, data);
    }
}
RelayExtended2Cell.rcommand = 15;

exports.RelayExtended2Cell = RelayExtended2Cell;
//# sourceMappingURL=cell.cjs.map
