'use strict';

var binary = require('../../../../../libs/binary.cjs');
var errors$1 = require('../errors.cjs');
var errors = require('../../../errors.cjs');

class AuthChallengeCell {
    constructor(circuit, challenge, methods) {
        this.circuit = circuit;
        this.challenge = challenge;
        this.methods = methods;
        this.class = AuthChallengeCell;
    }
    pack() {
        return this.cell().pack();
    }
    cell() {
        throw new errors.Unimplemented();
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new errors$1.InvalidCommand(this.name, cell.command);
        if (cell.circuit)
            throw new errors$1.InvalidCircuit(this.name, cell.circuit);
        const binary$1 = new binary.Binary(cell.payload);
        const challenge = binary$1.read(32);
        const nmethods = binary$1.readUint16();
        const methods = new Array(nmethods);
        for (let i = 0; i < nmethods; i++)
            methods[i] = binary$1.readUint16();
        return new this(cell.circuit, challenge, methods);
    }
}
AuthChallengeCell.command = 130;

exports.AuthChallengeCell = AuthChallengeCell;
//# sourceMappingURL=auth_challenge.cjs.map
