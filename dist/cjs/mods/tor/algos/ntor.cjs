'use strict';

var tslib = require('tslib');
var binary = require('../../../libs/binary.cjs');
var constants = require('../constants.cjs');

function request(publicx, idh, oid) {
    const binary$1 = binary.Binary.allocUnsafe(20 + 32 + 32);
    binary$1.write(idh);
    binary$1.write(oid);
    binary$1.write(publicx);
    return binary$1.buffer;
}
function response(data) {
    const binary$1 = new binary.Binary(data);
    const publicy = binary$1.read(32);
    const auth = binary$1.read(32);
    return { publicy, auth };
}
function finalize(sharedxy, sharedxb, publici, publicb, publicx, publicy) {
    return tslib.__awaiter(this, void 0, void 0, function* () {
        const protoid = "ntor-curve25519-sha256-1";
        const secreti = binary.Binary.allocUnsafe(32 + 32 + 20 + 32 + 32 + 32 + protoid.length);
        secreti.write(sharedxy);
        secreti.write(sharedxb);
        secreti.write(publici);
        secreti.write(publicb);
        secreti.write(publicx);
        secreti.write(publicy);
        secreti.writeString(protoid);
        const t_mac = Buffer.from(`${protoid}:mac`);
        const t_key = Buffer.from(`${protoid}:key_extract`);
        const t_verify = Buffer.from(`${protoid}:verify`);
        const hmac = { name: "HMAC", hash: "SHA-256" };
        const kt_verify = yield crypto.subtle.importKey("raw", t_verify, hmac, false, ["sign"]);
        const verify = Buffer.from(yield crypto.subtle.sign("HMAC", kt_verify, secreti.buffer));
        const server = "Server";
        const authi = binary.Binary.allocUnsafe(32 + 20 + 32 + 32 + 32 + protoid.length + server.length);
        authi.write(verify);
        authi.write(publici);
        authi.write(publicb);
        authi.write(publicy);
        authi.write(publicx);
        authi.writeString(protoid);
        authi.writeString(server);
        const kt_mac = yield crypto.subtle.importKey("raw", t_mac, hmac, false, ["sign"]);
        const auth = Buffer.from(yield crypto.subtle.sign("HMAC", kt_mac, authi.buffer));
        const m_expand = Buffer.from(`${protoid}:key_expand`);
        const hkdf = { name: "HKDF", hash: "SHA-256", info: m_expand, salt: t_key };
        const ksecret = yield crypto.subtle.importKey("raw", secreti.buffer, "HKDF", false, ["deriveBits"]);
        const key = Buffer.from(yield crypto.subtle.deriveBits(hkdf, ksecret, 8 * ((constants.HASH_LEN * 3) + (constants.KEY_LEN * 2))));
        const k = new binary.Binary(key);
        const forwardDigest = k.read(constants.HASH_LEN);
        const backwardDigest = k.read(constants.HASH_LEN);
        const forwardKey = k.read(constants.KEY_LEN);
        const backwardKey = k.read(constants.KEY_LEN);
        const nonce = k.read(constants.HASH_LEN);
        return { forwardDigest, backwardDigest, forwardKey, backwardKey, auth, nonce };
    });
}

exports.finalize = finalize;
exports.request = request;
exports.response = response;
//# sourceMappingURL=ntor.cjs.map
