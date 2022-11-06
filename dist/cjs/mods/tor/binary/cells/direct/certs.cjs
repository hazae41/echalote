'use strict';

var tslib = require('tslib');
var berith = require('@hazae41/berith');
var paimon = require('@hazae41/paimon');
var binary = require('../../../../../libs/binary.cjs');
var errors$1 = require('../errors.cjs');
var errors$2 = require('../../certs/errors.cjs');
var cert$1 = require('../../certs/cross/cert.cjs');
var cert$2 = require('../../certs/ed25519/cert.cjs');
var cert = require('../../certs/rsa/cert.cjs');
var errors = require('../../../errors.cjs');

class CertsCell {
    constructor(circuit, certs) {
        this.circuit = circuit;
        this.certs = certs;
        this.class = CertsCell;
    }
    pack() {
        return this.cell().pack();
    }
    getIdHash() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (!this.certs.id)
                throw new Error(`Undefined ID cert`);
            const key = this.certs.id.cert.publicKey.rawData;
            const hash = yield crypto.subtle.digest("SHA-1", key);
            return Buffer.from(hash);
        });
    }
    checkId() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (!this.certs.id)
                throw new Error(`Undefined ID cert`);
            this.certs.id.check();
            const algo = this.certs.id.cert.publicKey.algorithm;
            if (!("modulusLength" in algo))
                throw new Error(`Undefined modulus length for ID cert`);
            if (algo.modulusLength !== 1024)
                throw new Error(`Invalid modulus length for ID cert`);
            const { publicKey, signatureAlgorithm } = this.certs.id.cert;
            const key = yield crypto.subtle.importKey("spki", publicKey.rawData, signatureAlgorithm, true, ["verify"]);
            const verified = yield crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, this.certs.id.cert.signature, this.certs.id.cert.tbs);
            if (!verified)
                throw new Error(`Invalid signature for ID cert`);
        });
    }
    checkIdToTls() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (!this.certs.id)
                throw new Error(`Undefined ID cert`);
            if (!this.certs.id_to_tls)
                throw new Error(`Undefined ID_TO_TLS cert`);
            this.certs.id_to_tls.check();
            const { publicKey, signatureAlgorithm } = this.certs.id.cert;
            const key = yield crypto.subtle.importKey("spki", publicKey.rawData, signatureAlgorithm, true, ["verify"]);
            const verified = yield crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, this.certs.id_to_tls.cert.signature, this.certs.id_to_tls.cert.tbs);
            if (!verified)
                throw new Error(`Invalid signature for ID_TO_TLS cert`);
            console.warn("Could not verify ID_TO_TLS cert key");
        });
    }
    checkIdToEid() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (!this.certs.id)
                throw new Error(`Undefined ID cert`);
            if (!this.certs.id_to_eid)
                throw new Error(`Undefined ID_TO_EID cert`);
            this.certs.id_to_eid.check();
            const key = Buffer.from(this.certs.id.cert.publicKey.rawData);
            const identity = paimon.RsaPublicKey.from_public_key_der(key);
            const prefix = Buffer.from("Tor TLS RSA/Ed25519 cross-certificate");
            const prefixed = Buffer.concat([prefix, this.certs.id_to_eid.payload]);
            const hashed = Buffer.from(yield crypto.subtle.digest("SHA-256", prefixed));
            const verified = identity.verify(paimon.PaddingScheme.new_pkcs1v15_sign_raw(), hashed, this.certs.id_to_eid.signature);
            if (!verified)
                throw new Error(`Invalid signature for ID_TO_EID cert`);
        });
    }
    checkEidToSigning() {
        if (!this.certs.id_to_eid)
            throw new Error(`Undefined ID_TO_EID cert`);
        if (!this.certs.eid_to_signing)
            throw new Error(`Undefined EID_TO_SIGNING cert`);
        this.certs.eid_to_signing.check();
        const identity = new berith.Ed25519PublicKey(this.certs.id_to_eid.key);
        const signature = new berith.Ed25519Signature(this.certs.eid_to_signing.signature);
        const verified = identity.verify(this.certs.eid_to_signing.payload, signature);
        if (!verified)
            throw new Error(`Invalid signature for EID_TO_SIGNING cert`);
    }
    checkSigningToTls() {
        if (!this.certs.eid_to_signing)
            throw new Error(`Undefined EID_TO_SIGNING cert`);
        if (!this.certs.signing_to_tls)
            throw new Error(`Undefined SIGNING_TO_TLS cert`);
        this.certs.signing_to_tls.check();
        const identity = new berith.Ed25519PublicKey(this.certs.eid_to_signing.certKey);
        const signature = new berith.Ed25519Signature(this.certs.signing_to_tls.signature);
        const verified = identity.verify(this.certs.signing_to_tls.payload, signature);
        if (!verified)
            throw new Error(`Invalid signature for SIGNING_TO_TLS cert`);
        console.warn("Could not verify SIGNING_TO_TLS cert key");
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
        const ncerts = binary$1.readUint8();
        const certs = {};
        for (let i = 0; i < ncerts; i++) {
            const type = binary$1.readUint8();
            const length = binary$1.readUint16();
            if (type === cert.Cert.types.ID) {
                if (certs.id)
                    throw new errors$2.Duplicated(type);
                certs.id = cert.Cert.read(binary$1, type, length);
                continue;
            }
            if (type === cert.Cert.types.ID_TO_AUTH) {
                if (certs.id_to_auth)
                    throw new errors$2.Duplicated(type);
                certs.id_to_auth = cert.Cert.read(binary$1, type, length);
                continue;
            }
            if (type === cert.Cert.types.ID_TO_TLS) {
                if (certs.id_to_tls)
                    throw new errors$2.Duplicated(type);
                certs.id_to_tls = cert.Cert.read(binary$1, type, length);
                continue;
            }
            if (type === cert$1.Cert.types.ID_TO_EID) {
                if (certs.id_to_eid)
                    throw new errors$2.Duplicated(type);
                certs.id_to_eid = cert$1.Cert.read(binary$1, type, length);
                continue;
            }
            if (type === cert$2.Cert.types.EID_TO_SIGNING) {
                if (certs.eid_to_signing)
                    throw new errors$2.Duplicated(type);
                certs.eid_to_signing = cert$2.Cert.read(binary$1, type, length);
                continue;
            }
            if (type === cert$2.Cert.types.SIGNING_TO_TLS) {
                if (certs.signing_to_tls)
                    throw new errors$2.Duplicated(type);
                certs.signing_to_tls = cert$2.Cert.read(binary$1, type, length);
                continue;
            }
            if (type === cert$2.Cert.types.SIGNING_TO_AUTH) {
                if (certs.signing_to_auth)
                    throw new errors$2.Duplicated(type);
                certs.signing_to_auth = cert$2.Cert.read(binary$1, type, length);
                continue;
            }
            throw new Error(`Unknown CERTS cell cert type ${type}`);
        }
        return new this(cell.circuit, certs);
    }
}
CertsCell.command = 129;

exports.CertsCell = CertsCell;
//# sourceMappingURL=certs.cjs.map
