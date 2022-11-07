'use strict';

var tslib = require('tslib');
var berith = require('@hazae41/berith');
var foras = require('@hazae41/foras');
var morax = require('@hazae41/morax');
var paimon = require('@hazae41/paimon');
var zepar = require('@hazae41/zepar');
var binary = require('../../libs/binary.cjs');
var bits = require('../../libs/bits.cjs');
var events = require('../../libs/events.cjs');
var future = require('../../libs/future.cjs');
var kdftor = require('./algos/kdftor.cjs');
var address = require('./binary/address.cjs');
var cell = require('./binary/cells/cell.cjs');
var cell$5 = require('./binary/cells/direct/auth_challenge/cell.cjs');
var cell$4 = require('./binary/cells/direct/certs/cell.cjs');
var cell$7 = require('./binary/cells/direct/created_fast/cell.cjs');
var cell$h = require('./binary/cells/direct/create_fast/cell.cjs');
var cell$8 = require('./binary/cells/direct/destroy/cell.cjs');
var cell$6 = require('./binary/cells/direct/netinfo/cell.cjs');
var cell$1 = require('./binary/cells/direct/padding/cell.cjs');
var cell$a = require('./binary/cells/direct/padding_negociate/cell.cjs');
var cell$9 = require('./binary/cells/direct/relay/cell.cjs');
var cell$3 = require('./binary/cells/direct/versions/cell.cjs');
var cell$2 = require('./binary/cells/direct/vpadding/cell.cjs');
var cell$c = require('./binary/cells/relayed/relay_connected/cell.cjs');
var cell$d = require('./binary/cells/relayed/relay_data/cell.cjs');
var cell$f = require('./binary/cells/relayed/relay_drop/cell.cjs');
var cell$e = require('./binary/cells/relayed/relay_end/cell.cjs');
var cell$b = require('./binary/cells/relayed/relay_extended2/cell.cjs');
var cell$g = require('./binary/cells/relayed/relay_truncated/cell.cjs');
var circuit = require('./circuit.cjs');
var authorities = require('./consensus/authorities.cjs');
var target = require('./target.cjs');

class Tor extends EventTarget {
    constructor(tls) {
        super();
        this.tls = tls;
        this.class = Tor;
        this._state = { type: "none" };
        this.authorities = new Array();
        this.circuits = new Map();
        this.streams = new TransformStream();
        this.buffer = Buffer.allocUnsafe(4 * 4096);
        this.wbuffer = new binary.Binary(this.buffer);
        this.rbuffer = new binary.Binary(this.buffer);
        this.fallbacks = {
            exits: new Array(),
            middles: new Array()
        };
        const onMessage = this.onMessage.bind(this);
        this.tls.addEventListener("message", onMessage, { passive: true });
        this.authorities = authorities.parseAuthorities();
        this.tryRead();
    }
    get state() {
        return this._state;
    }
    init() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            yield paimon.Paimon.initBundledOnce();
            yield berith.Berith.initBundledOnce();
            yield zepar.Zepar.initBundledOnce();
            yield morax.Morax.initBundledOnce();
            yield foras.Foras.initBundledOnce();
        });
    }
    send(...arrays) {
        let length = 0;
        for (let i = 0; i < arrays.length; i++)
            length += arrays[i].length;
        const packet = binary.Binary.allocUnsafe(length);
        for (const array of arrays)
            packet.write(array);
        this.tls.send(packet.buffer);
    }
    onMessage(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            const writer = this.streams.writable.getWriter();
            writer.write(message.data).catch(console.warn);
            writer.releaseLock();
        });
    }
    tryRead() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const reader = this.streams.readable.getReader();
            try {
                yield this.read(reader);
            }
            finally {
                reader.releaseLock();
            }
        });
    }
    read(reader) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            while (true) {
                const { done, value } = yield reader.read();
                if (done)
                    break;
                this.wbuffer.write(value);
                yield this.onRead();
            }
        });
    }
    onRead() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            this.rbuffer.buffer = this.buffer.subarray(0, this.wbuffer.offset);
            while (this.rbuffer.remaining) {
                try {
                    const rawCell = this._state.type === "none"
                        ? cell.OldCell.tryRead(this.rbuffer)
                        : cell.NewCell.tryRead(this.rbuffer);
                    if (!rawCell)
                        break;
                    const cell$1 = rawCell.type === "old"
                        ? cell.OldCell.unpack(this, rawCell)
                        : cell.NewCell.unpack(this, rawCell);
                    yield this.onCell(cell$1);
                }
                catch (e) {
                    console.error(e);
                }
            }
            if (!this.rbuffer.offset)
                return;
            if (this.rbuffer.offset === this.wbuffer.offset) {
                this.rbuffer.offset = 0;
                this.wbuffer.offset = 0;
                return;
            }
            if (this.rbuffer.remaining && this.wbuffer.remaining < 4096) {
                console.debug(`Reallocating buffer`);
                const remaining = this.buffer.subarray(this.rbuffer.offset, this.wbuffer.offset);
                this.rbuffer.offset = 0;
                this.wbuffer.offset = 0;
                this.buffer = Buffer.allocUnsafe(4 * 4096);
                this.rbuffer.buffer = this.buffer;
                this.wbuffer.buffer = this.buffer;
                this.wbuffer.write(remaining);
                return;
            }
        });
    }
    onCell(cell$3) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (cell$3.command === cell$1.PaddingCell.command)
                return console.debug(`Received PADDING cell`);
            if (cell$3.command === cell$2.VariablePaddingCell.command)
                return console.debug(`Received VPADDING cell`);
            if (this._state.type === "none")
                return yield this.onNoneStateCell(cell$3);
            if (cell$3 instanceof cell.OldCell)
                throw new Error(`Can't uncell post-version cell from old cell`);
            if (this._state.type === "versioned")
                return yield this.onVersionedStateCell(cell$3);
            if (this._state.type === "handshaking")
                return yield this.onHandshakingStateCell(cell$3);
            if (this._state.type === "handshaked")
                return yield this.onHandshakedStateCell(cell$3);
            throw new Error(`Unknown state`);
        });
    }
    onNoneStateCell(cell$1) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "none")
                throw new Error(`State is not none`);
            if (cell$1 instanceof cell.NewCell)
                throw new Error(`Can't uncell pre-version cell from new cell`);
            if (cell$1.command === cell$3.VersionsCell.command)
                return yield this.onVersionsCell(cell$1);
            console.debug(`Unknown pre-version cell ${cell$1.command}`);
        });
    }
    onVersionedStateCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "versioned")
                throw new Error(`State is not versioned`);
            if (cell.command === cell$4.CertsCell.command)
                return yield this.onCertsCell(cell);
            console.debug(`Unknown versioned-state cell ${cell.command}`);
        });
    }
    onHandshakingStateCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "handshaking")
                throw new Error(`State is not handshaking`);
            if (cell.command === cell$5.AuthChallengeCell.command)
                return yield this.onAuthChallengeCell(cell);
            if (cell.command === cell$6.NetinfoCell.command)
                return yield this.onNetinfoCell(cell);
            console.debug(`Unknown handshaking-state cell ${cell.command}`);
        });
    }
    onHandshakedStateCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (cell.command === cell$7.CreatedFastCell.command)
                return yield this.onCreatedFastCell(cell);
            if (cell.command === cell$8.DestroyCell.command)
                return yield this.onDestroyCell(cell);
            if (cell.command === cell$9.RelayCell.command)
                return yield this.onRelayCell(cell);
            console.debug(`Unknown handshaked-state cell ${cell.command}`);
        });
    }
    onVersionsCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "none")
                throw new Error(`State is not none`);
            const data = cell$3.VersionsCell.uncell(cell);
            const event = new MessageEvent("VERSIONS", { data });
            if (!this.dispatchEvent(event))
                return;
            if (!data.versions.includes(5))
                throw new Error(`Incompatible versions`);
            this._state = { type: "versioned", version: 5 };
            const event2 = new MessageEvent("versioned", { data: 5 });
            if (!this.dispatchEvent(event2))
                return;
            console.debug(`VERSIONS`, data);
        });
    }
    onCertsCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "versioned")
                throw new Error(`State is not versioned`);
            const data = cell$4.CertsCell.uncell(cell);
            const event = new MessageEvent("CERTS", { data });
            if (!this.dispatchEvent(event))
                return;
            const idh = yield data.getIdHash();
            yield data.checkId();
            yield data.checkIdToTls();
            yield data.checkIdToEid();
            data.checkEidToSigning();
            data.checkSigningToTls();
            const { certs } = data;
            const guard = { certs, idh };
            const { version } = this._state;
            this._state = { type: "handshaking", version, guard };
            const event2 = new MessageEvent("handshaking", {});
            if (!this.dispatchEvent(event2))
                return;
            console.debug(`CERTS`, data);
        });
    }
    onAuthChallengeCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "handshaking")
                throw new Error(`State is not handshaking`);
            const data = cell$5.AuthChallengeCell.uncell(cell);
            const event = new MessageEvent("AUTH_CHALLENGE", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`AUTH_CHALLENGE`, data);
        });
    }
    onNetinfoCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "handshaking")
                throw new Error(`State is not handshaking`);
            const data = cell$6.NetinfoCell.uncell(cell);
            const event = new MessageEvent("NETINFO", { data });
            if (!this.dispatchEvent(event))
                return;
            const address$1 = new address.TypedAddress(4, Buffer.from([127, 0, 0, 1]));
            const netinfo = new cell$6.NetinfoCell(undefined, 0, address$1, []);
            const pversion = cell$a.PaddingNegociateCell.versions.ZERO;
            const pcommand = cell$a.PaddingNegociateCell.commands.STOP;
            const padding = new cell$a.PaddingNegociateCell(undefined, pversion, pcommand, 0, 0);
            this.send(netinfo.pack(), padding.pack());
            const { version, guard } = this._state;
            this._state = { type: "handshaked", version, guard };
            const event2 = new MessageEvent("handshake", {});
            if (!this.dispatchEvent(event2))
                return;
            console.debug(`NETINFO`, data);
        });
    }
    onCreatedFastCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$7.CreatedFastCell.uncell(cell);
            const event = new MessageEvent("CREATED_FAST", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`CREATED_FAST`, data);
        });
    }
    onDestroyCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$8.DestroyCell.uncell(cell);
            const event = new MessageEvent("DESTROY", { data });
            if (!this.dispatchEvent(event))
                return;
            this.circuits.delete(data.circuit.id);
            console.debug(`DESTROY`, data);
        });
    }
    onRelayCell(parent) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const cell = yield cell$9.RelayCell.uncell(parent);
            if (cell.rcommand === cell$b.RelayExtended2Cell.rcommand)
                return yield this.onRelayExtended2Cell(cell);
            if (cell.rcommand === cell$c.RelayConnectedCell.rcommand)
                return yield this.onRelayConnectedCell(cell);
            if (cell.rcommand === cell$d.RelayDataCell.rcommand)
                return yield this.onRelayDataCell(cell);
            if (cell.rcommand === cell$e.RelayEndCell.rcommand)
                return yield this.onRelayEndCell(cell);
            if (cell.rcommand === cell$f.RelayDropCell.rcommand)
                return yield this.onRelayDropCell(cell);
            if (cell.rcommand === cell$g.RelayTruncatedCell.rcommand)
                return yield this.onRelayTruncatedCell(cell);
            console.debug(`Unknown relay cell ${cell.rcommand}`);
        });
    }
    onRelayExtended2Cell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$b.RelayExtended2Cell.uncell(cell);
            const event = new MessageEvent("RELAY_EXTENDED2", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`RELAY_EXTENDED2`, data);
        });
    }
    onRelayConnectedCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$c.RelayConnectedCell.uncell(cell);
            const event = new MessageEvent("RELAY_CONNECTED", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`RELAY_CONNECTED`, data);
        });
    }
    onRelayDataCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$d.RelayDataCell.uncell(cell);
            const event = new MessageEvent("RELAY_DATA", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`RELAY_DATA`, data);
        });
    }
    onRelayEndCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$e.RelayEndCell.uncell(cell);
            const event = new MessageEvent("RELAY_END", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`RELAY_END`, data);
        });
    }
    onRelayDropCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$f.RelayDropCell.uncell(cell);
            const event = new MessageEvent("RELAY_DROP", { data });
            if (!this.dispatchEvent(event))
                return;
            console.debug(`RELAY_DROP`, data);
        });
    }
    onRelayTruncatedCell(cell) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const data = cell$g.RelayTruncatedCell.uncell(cell);
            const event = new MessageEvent("RELAY_TRUNCATED", { data });
            if (!this.dispatchEvent(event))
                return;
            data.circuit.targets.pop();
            console.debug(`RELAY_TRUNCATED`, data);
        });
    }
    waitHandshake() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const future$1 = new future.Future();
            try {
                this.tls.addEventListener("close", future$1.err, { passive: true });
                this.tls.addEventListener("error", future$1.err, { passive: true });
                this.addEventListener("handshake", future$1.ok, { passive: true });
                yield future$1.promise;
            }
            catch (e) {
                throw events.Events.error(e);
            }
            finally {
                this.tls.removeEventListener("error", future$1.err);
                this.tls.removeEventListener("close", future$1.err);
                this.removeEventListener("handshake", future$1.ok);
            }
        });
    }
    handshake() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            yield this.tls.open();
            const handshake = this.waitHandshake();
            this.send(new cell$3.VersionsCell(undefined, [5]).pack());
            yield handshake;
        });
    }
    waitCreatedFast(circuit) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const future$1 = new future.Future();
            const onCreatedFastCell = (event) => {
                const message = event;
                if (message.data.circuit === circuit)
                    future$1.ok(message.data);
            };
            try {
                this.tls.addEventListener("close", future$1.err, { passive: true });
                this.tls.addEventListener("error", future$1.err, { passive: true });
                this.addEventListener("CREATED_FAST", onCreatedFastCell, { passive: true });
                return yield future$1.promise;
            }
            catch (e) {
                throw events.Events.error(e);
            }
            finally {
                this.tls.removeEventListener("error", future$1.err);
                this.tls.removeEventListener("close", future$1.err);
                this.removeEventListener("CREATED_FAST", onCreatedFastCell);
            }
        });
    }
    create() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this._state.type !== "handshaked")
                throw new Error(`Can't create a circuit yet`);
            const circuitId = new bits.Bitmask(Date.now())
                .set(31, true)
                .export();
            const circuit$1 = new circuit.Circuit(this, circuitId);
            this.circuits.set(circuitId, circuit$1);
            const material = Buffer.allocUnsafe(20);
            crypto.getRandomValues(material);
            const pcreated = this.waitCreatedFast(circuit$1);
            this.send(new cell$h.CreateFastCell(circuit$1, material).pack());
            const created = yield pcreated;
            const k0 = Buffer.concat([material, created.material]);
            const result = yield kdftor.kdftor(k0);
            if (!result.keyHash.equals(created.derivative))
                throw new Error(`Invalid KDF-TOR key hash`);
            const forwardDigest = new morax.Sha1Hasher();
            const backwardDigest = new morax.Sha1Hasher();
            forwardDigest.update(result.forwardDigest);
            backwardDigest.update(result.backwardDigest);
            const forwardKey = new zepar.Aes128Ctr128BEKey(result.forwardKey, Buffer.alloc(16));
            const backwardKey = new zepar.Aes128Ctr128BEKey(result.backwardKey, Buffer.alloc(16));
            const target$1 = new target.Target(this._state.guard.idh, circuit$1, forwardDigest, backwardDigest, forwardKey, backwardKey);
            circuit$1.targets.push(target$1);
            return circuit$1;
        });
    }
}

exports.Tor = Tor;
//# sourceMappingURL=tor.cjs.map
