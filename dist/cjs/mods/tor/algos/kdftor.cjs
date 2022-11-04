'use strict';

var tslib = require('tslib');
var binary = require('../../../libs/binary.cjs');
var constants = require('../constants.cjs');

function kdftor(k0) {
    return tslib.__awaiter(this, void 0, void 0, function* () {
        const ki = binary.Binary.allocUnsafe(k0.length + 1);
        ki.write(k0);
        const k = binary.Binary.allocUnsafe(constants.HASH_LEN * 5);
        for (let i = 0; k.remaining > 0; i++) {
            ki.writeUint8(i, true);
            const h = yield crypto.subtle.digest("SHA-1", ki.buffer);
            k.write(Buffer.from(h));
        }
        k.offset = 0;
        const keyHash = k.read(constants.HASH_LEN);
        const forwardDigest = k.read(constants.HASH_LEN);
        const backwardDigest = k.read(constants.HASH_LEN);
        const forwardKey = k.read(constants.KEY_LEN);
        const backwardKey = k.read(constants.KEY_LEN);
        return { keyHash, forwardDigest, backwardDigest, forwardKey, backwardKey };
    });
}

exports.kdftor = kdftor;
//# sourceMappingURL=kdftor.cjs.map
