'use strict';

var binary = require('../../../../../libs/binary.cjs');

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
        throw new Error(`Unimplemented`);
    }
    static uncell(cell) {
        if (cell.command !== this.command)
            throw new Error(`Invalid AUTH_CHALLENGE cell command ${cell.command}`);
        if (cell.circuit)
            throw new Error(`Can't uncell DESTROY cell on circuit > 0`);
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
