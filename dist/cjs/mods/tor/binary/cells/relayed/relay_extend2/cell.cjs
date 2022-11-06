'use strict';

var tslib = require('tslib');
var binary = require('../../../../../../libs/binary.cjs');
var cell = require('../../direct/relay_early/cell.cjs');
var constants = require('../../../../constants.cjs');

class RelayExtend2Cell {
    constructor(circuit, stream, type, links, data) {
        this.circuit = circuit;
        this.stream = stream;
        this.type = type;
        this.links = links;
        this.data = data;
        this.class = RelayExtend2Cell;
    }
    pack() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            return yield this.cell().pack();
        });
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(constants.PAYLOAD_LEN);
        binary$1.writeUint8(this.links.length);
        for (const link of this.links)
            link.write(binary$1);
        binary$1.writeUint16(this.type);
        binary$1.writeUint16(this.data.length);
        binary$1.write(this.data);
        return new cell.RelayEarlyCell(this.circuit, this.stream, this.class.rcommand, binary$1.sliced);
    }
}
RelayExtend2Cell.rcommand = 14;
RelayExtend2Cell.types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
};

exports.RelayExtend2Cell = RelayExtend2Cell;
//# sourceMappingURL=cell.cjs.map
