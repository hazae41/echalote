'use strict';

var tslib = require('tslib');
var berith = require('@hazae41/berith');
var morax = require('@hazae41/morax');
var zepar = require('@hazae41/zepar');
var array = require('../../libs/array.cjs');
var bits = require('../../libs/bits.cjs');
var events = require('../../libs/events.cjs');
var future = require('../../libs/future.cjs');
var ntor = require('./algos/ntor.cjs');
var relay_begin = require('./binary/cells/relayed/relay_begin.cjs');
var relay_extend2 = require('./binary/cells/relayed/relay_extend2.cjs');
var relay_truncate = require('./binary/cells/relayed/relay_truncate.cjs');
var http = require('./streams/http.cjs');
var tcp = require('./streams/tcp.cjs');
var target = require('./target.cjs');

class Circuit extends EventTarget {
    constructor(tor, id) {
        super();
        this.tor = tor;
        this.id = id;
        this.class = Circuit;
        this._nonce = 1;
        this._closed = false;
        this.targets = new Array();
        this.streams = new Map();
        const onDestroyCell = this.onDestroyCell.bind(this);
        this.tor.addEventListener("DESTROY", onDestroyCell, { passive: true });
        const onRelayExtended2Cell = this.onRelayExtended2Cell.bind(this);
        this.tor.addEventListener("RELAY_EXTENDED2", onRelayExtended2Cell, { passive: true });
        const onRelayTruncatedCell = this.onRelayTruncatedCell.bind(this);
        this.tor.addEventListener("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true });
        const onRelayConnectedCell = this.onRelayConnectedCell.bind(this);
        this.tor.addEventListener("RELAY_CONNECTED", onRelayConnectedCell, { passive: true });
        const onRelayDataCell = this.onRelayDataCell.bind(this);
        this.tor.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true });
        const onRelayEndCell = this.onRelayEndCell.bind(this);
        this.tor.addEventListener("RELAY_END", onRelayEndCell, { passive: true });
    }
    get closed() {
        return this._closed;
    }
    onDestroyCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.circuit !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
            this._closed = true;
        });
    }
    onRelayExtended2Cell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.circuit !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
        });
    }
    onRelayTruncatedCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.circuit !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
        });
    }
    onRelayConnectedCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.circuit !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
        });
    }
    onRelayDataCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.circuit !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
        });
    }
    onRelayEndCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.circuit !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
            this.streams.delete(message.data.stream.id);
        });
    }
    waitExtended() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const future$1 = new future.Future();
            try {
                this.tor.tls.addEventListener("close", future$1.err, { passive: true });
                this.tor.tls.addEventListener("error", future$1.err, { passive: true });
                this.addEventListener("DESTROY", future$1.err, { passive: true });
                this.addEventListener("RELAY_EXTENDED2", future$1.ok, { passive: true });
                return yield future$1.promise;
            }
            catch (e) {
                throw events.Events.error(e);
            }
            finally {
                this.tor.tls.removeEventListener("error", future$1.err);
                this.tor.tls.removeEventListener("close", future$1.err);
                this.removeEventListener("DESTROY", future$1.err);
                this.removeEventListener("RELAY_EXTENDED2", future$1.ok);
            }
        });
    }
    extend(exit) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const fallback = array.randomOf(this.tor.fallbacks[exit ? "exits" : "middles"]);
            if (!fallback)
                throw new Error("Can't find fallback");
            return yield this._extend(fallback);
        });
    }
    _extend(fallback) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            console.log("fallback", fallback);
            const idh = Buffer.from(fallback.id, "hex");
            const eid = Buffer.from(fallback.eid, "base64");
            const links = fallback.hosts.map(it => it.startsWith("[")
                ? relay_extend2.LinkIPv6.from(it)
                : relay_extend2.LinkIPv4.from(it));
            links.push(new relay_extend2.LinkLegacyID(idh));
            links.push(new relay_extend2.LinkModernID(eid));
            const xsecretx = new berith.X25519StaticSecret();
            const publicx = Buffer.from(xsecretx.to_public().to_bytes().buffer);
            const publicb = Buffer.from(fallback.onion);
            const request = ntor.request(publicx, idh, publicb);
            const pextended2 = this.waitExtended();
            this.tor.send(yield new relay_extend2.RelayExtend2Cell(this, undefined, relay_extend2.RelayExtend2Cell.types.NTOR, links, request).pack());
            const extended2 = yield pextended2;
            const response = ntor.response(extended2.data.data);
            const { publicy } = response;
            const xpublicy = new berith.X25519PublicKey(publicy);
            const xpublicb = new berith.X25519PublicKey(publicb);
            const sharedxy = Buffer.from(xsecretx.diffie_hellman(xpublicy).to_bytes().buffer);
            const sharedxb = Buffer.from(xsecretx.diffie_hellman(xpublicb).to_bytes().buffer);
            const result = yield ntor.finalize(sharedxy, sharedxb, idh, publicb, publicx, publicy);
            const forwardDigest = new morax.Sha1Hasher();
            const backwardDigest = new morax.Sha1Hasher();
            forwardDigest.update(result.forwardDigest);
            backwardDigest.update(result.backwardDigest);
            const forwardKey = new zepar.Aes128Ctr128BEKey(result.forwardKey, Buffer.alloc(16));
            const backwardKey = new zepar.Aes128Ctr128BEKey(result.backwardKey, Buffer.alloc(16));
            const target$1 = new target.Target(idh, this, forwardDigest, backwardDigest, forwardKey, backwardKey);
            this.targets.push(target$1);
        });
    }
    waitTruncated() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const future$1 = new future.Future();
            try {
                this.tor.tls.addEventListener("close", future$1.err, { passive: true });
                this.tor.tls.addEventListener("error", future$1.err, { passive: true });
                this.addEventListener("DESTROY", future$1.err, { passive: true });
                this.addEventListener("RELAY_TRUNCATED", future$1.ok, { passive: true });
                return yield future$1.promise;
            }
            catch (e) {
                throw events.Events.error(e);
            }
            finally {
                this.tor.tls.removeEventListener("error", future$1.err);
                this.tor.tls.removeEventListener("close", future$1.err);
                this.removeEventListener("DESTROY", future$1.err);
                this.removeEventListener("RELAY_TRUNCATED", future$1.ok);
            }
        });
    }
    truncate(reason = relay_truncate.RelayTruncateCell.reasons.NONE) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const ptruncated = this.waitTruncated();
            this.tor.send(yield new relay_truncate.RelayTruncateCell(this, undefined, reason).pack());
            yield ptruncated;
        });
    }
    open(hostname, port, signal) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const streamId = this._nonce++;
            const stream = new tcp.TcpStream(this, streamId, signal);
            this.streams.set(streamId, stream);
            const flags = new bits.Bitmask(0)
                .set(relay_begin.RelayBeginCell.flags.IPV4_OK, true)
                .set(relay_begin.RelayBeginCell.flags.IPV6_NOT_OK, false)
                .set(relay_begin.RelayBeginCell.flags.IPV6_PREFER, true);
            this.tor.send(yield new relay_begin.RelayBeginCell(this, stream, `${hostname}:${port}`, flags).pack());
            return stream;
        });
    }
    fetch(input, init) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const req = new Request(input, init);
            const url = new URL(req.url);
            const port = Number(url.port) || 80;
            const tcp = yield this.open(url.hostname, port, req.signal);
            return yield new http.HttpStream(tcp, req, url).res.promise;
        });
    }
}

exports.Circuit = Circuit;
//# sourceMappingURL=circuit.cjs.map
