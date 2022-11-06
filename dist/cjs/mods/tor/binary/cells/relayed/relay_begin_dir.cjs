'use strict';

var tslib = require('tslib');
var binary = require('../../../../../libs/binary.cjs');
var relay = require('../direct/relay.cjs');
var errors = require('../errors.cjs');
var constants = require('../../../constants.cjs');

class RelayBeginDirCell {
    constructor(circuit, stream) {
        this.circuit = circuit;
        this.stream = stream;
        this.class = RelayBeginDirCell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.fill();
        return new relay.RelayCell(this.circuit, this.stream, this.class.rcommand, binary$1.sliced);
    }
    static uncell(cell) {
        if (cell.rcommand !== this.rcommand)
            throw new errors.InvalidRelayCommand(this.name, cell.rcommand);
        if (!cell.stream)
            throw new errors.InvalidStream(this.name, cell.stream);
        if (cell.data.find(it => it !== 0))
            throw new Error(`Invalid ${this.name} data`);
        return new this(cell.circuit, cell.stream);
    }
}
RelayBeginDirCell.rcommand = 13;

exports.RelayBeginDirCell = RelayBeginDirCell;
//# sourceMappingURL=relay_begin_dir.cjs.map
