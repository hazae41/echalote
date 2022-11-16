'use strict';

var tslib = require('tslib');
var binary = require('../../../libs/binary.cjs');
var events = require('../../../libs/events.cjs');
var cell$1 = require('../binary/cells/relayed/relay_data/cell.cjs');
var cell = require('../binary/cells/relayed/relay_end/cell.cjs');
var reason = require('../binary/cells/relayed/relay_end/reason.cjs');
var constants = require('../constants.cjs');

const DATA_LEN = constants.PAYLOAD_LEN - (1 + 2 + 2 + 4 + 2);
class TcpStream extends EventTarget {
    constructor(circuit, id, signal) {
        var _a;
        super();
        this.circuit = circuit;
        this.id = id;
        this.signal = signal;
        /**
         * Output stream bufferer
         */
        this.rstreams = new TransformStream();
        /**
         * Input stream bufferer
         */
        this.wstreams = new TransformStream();
        /**
         * Output stream
         */
        this.readable = this.rstreams.readable;
        /**
         * Input stream
         */
        this.writable = this.wstreams.writable;
        this.closed = false;
        const onRelayDataCell = this.onRelayDataCell.bind(this);
        this.circuit.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true });
        const onRelayEndCell = this.onRelayEndCell.bind(this);
        this.circuit.addEventListener("RELAY_END", onRelayEndCell, { passive: true });
        const onRelayTruncatedCell = this.onRelayTruncatedCell.bind(this);
        this.circuit.addEventListener("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true });
        const onAbort = this.onAbort.bind(this);
        (_a = this.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", onAbort, { passive: true, once: true });
        this.tryWrite().catch(console.warn);
    }
    onAbort(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const abort = event;
            const event2 = events.Events.clone(event);
            if (!this.dispatchEvent(event2))
                return;
            if (this.closed)
                return;
            this.closed = true;
            const rwriter = this.rstreams.writable.getWriter();
            rwriter.abort(abort.target.reason).catch(console.warn);
            rwriter.releaseLock();
            const wwriter = this.wstreams.writable.getWriter();
            wwriter.abort(abort.target.reason).catch(console.warn);
            wwriter.releaseLock();
            const reason$1 = cell.RelayEndCell.reasons.REASON_UNKNOWN;
            const reason2 = new reason.RelayEndReasonOther(reason$1);
            const cell$1 = new cell.RelayEndCell(this.circuit, this, reason2);
            this.circuit.tor.send(yield cell$1.pack());
        });
    }
    onRelayDataCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.stream !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
            if (this.closed)
                return;
            const rwriter = this.rstreams.writable.getWriter();
            rwriter.write(message.data.data).catch(console.warn);
            rwriter.releaseLock();
        });
    }
    onRelayEndCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            if (message.data.stream !== this)
                return;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
            if (this.closed)
                return;
            this.closed = true;
            const rwriter = this.rstreams.writable.getWriter();
            rwriter.close().catch(console.warn);
            rwriter.releaseLock();
            const wwriter = this.wstreams.writable.getWriter();
            wwriter.close().catch(console.warn);
            wwriter.releaseLock();
        });
    }
    onRelayTruncatedCell(event) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const message = event;
            const message2 = events.Events.clone(message);
            if (!this.dispatchEvent(message2))
                return;
            if (this.closed)
                return;
            this.closed = true;
            const rwriter = this.rstreams.writable.getWriter();
            rwriter.abort(event).catch(console.warn);
            rwriter.releaseLock();
            const wwriter = this.wstreams.writable.getWriter();
            wwriter.abort(event).catch(console.warn);
            wwriter.releaseLock();
        });
    }
    tryWrite() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const reader = this.wstreams.readable.getReader();
            try {
                yield this.write(reader);
            }
            catch (e) {
                console.warn(e);
            }
            finally {
                reader.releaseLock();
            }
        });
    }
    write(reader) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            while (true) {
                const { done, value } = yield reader.read();
                if (done)
                    break;
                yield this.onWrite(value);
            }
        });
    }
    onWrite(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (chunk.length <= DATA_LEN) {
                const cell = new cell$1.RelayDataCell(this.circuit, this, chunk);
                return this.circuit.tor.send(yield cell.pack());
            }
            const binary$1 = new binary.Binary(chunk);
            const chunks = binary$1.split(DATA_LEN);
            for (const chunk of chunks) {
                const cell = new cell$1.RelayDataCell(this.circuit, this, chunk);
                this.circuit.tor.send(yield cell.pack());
            }
        });
    }
}

exports.TcpStream = TcpStream;
//# sourceMappingURL=tcp.cjs.map
