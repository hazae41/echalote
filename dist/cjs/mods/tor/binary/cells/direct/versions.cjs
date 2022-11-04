'use strict';

var binary = require('../../../../../libs/binary.cjs');
var cell = require('../cell.cjs');

class VersionsCell {
    constructor(circuit, versions) {
        this.circuit = circuit;
        this.versions = versions;
        this.class = VersionsCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        const binary$1 = binary.Binary.allocUnsafe(this.versions.length * 2);
        for (const version of this.versions)
            binary$1.writeUint16(version);
        return new cell.OldCell(this.circuit, this.class.command, binary$1.buffer);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new Error(`Invalid VERSIONS cell command ${cell.command}`);
        if (cell.circuit)
            throw new Error(`Can't uncell a RELAY cell from circuit > 0`);
        const binary$1 = new binary.Binary(cell.payload);
        const nversions = cell.payload.length / 2;
        const versions = new Array(nversions);
        for (let i = 0; i < nversions; i++)
            versions[i] = binary$1.readUint16();
        return new this(cell.circuit, versions);
    }
}
VersionsCell.command = 7;

exports.VersionsCell = VersionsCell;
//# sourceMappingURL=versions.cjs.map
