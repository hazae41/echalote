'use strict';

var tslib = require('tslib');
var foras = require('@hazae41/foras');
var binary = require('../../../libs/binary.cjs');
var future = require('../../../libs/future.cjs');
var strings = require('../../../libs/strings.cjs');

class HttpStream extends EventTarget {
    constructor(sstreams, req = new Request("/"), url = new URL(req.url)) {
        super();
        this.sstreams = sstreams;
        this.req = req;
        this.url = url;
        this.res = new future.Future();
        /**
         * HTTP output bufferer
         */
        this.rstreams = new TransformStream();
        /**
         * HTTP input bufferer
         */
        this.wstreams = new TransformStream();
        this.state = { type: "none", buffer: binary.Binary.allocUnsafe(10 * 1024) };
        if (req.body)
            req.body.pipeTo(this.wstreams.writable).catch(console.warn);
        else
            this.wstreams.writable.close().catch(console.warn);
        this.tryRead().catch(console.warn);
        this.tryWrite().catch(console.warn);
    }
    tryWrite() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const reader = this.wstreams.readable.getReader();
            try {
                yield this.write(reader);
            }
            catch (e) {
                console.warn(e);
                const writer = this.sstreams.writable.getWriter();
                writer.abort(e).catch(console.warn);
                writer.releaseLock();
                this.res.err(e);
            }
            finally {
                reader.releaseLock();
            }
        });
    }
    write(reader) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            yield this.onWriteStart();
            while (true) {
                const { done, value } = yield reader.read();
                if (done)
                    break;
                yield this.onWrite(value);
            }
            yield this.onWriteEnd();
        });
    }
    onWriteStart() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            let head = `${this.req.method} ${this.url.pathname} HTTP/1.1\r\n`;
            head += `Host: ${this.url.host}\r\n`;
            head += `Transfer-Encoding: chunked\r\n`;
            head += `Accept-Encoding: gzip\r\n`;
            this.req.headers.forEach((v, k) => head += `${k}: ${v}\r\n`);
            head += `\r\n`;
            const writer = this.sstreams.writable.getWriter();
            writer.write(Buffer.from(head)).catch(console.warn);
            writer.releaseLock();
        });
    }
    onWrite(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const text = new TextDecoder().decode(chunk);
            const length = text.length.toString(16);
            const line = `${length}\r\n${text}\r\n`;
            const writer = this.sstreams.writable.getWriter();
            writer.write(Buffer.from(line)).catch(console.warn);
            writer.releaseLock();
        });
    }
    onWriteEnd() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.from(`0\r\n\r\n\r\n`);
            const writer = this.sstreams.writable.getWriter();
            writer.write(buffer).catch(console.warn);
            writer.close().catch(console.warn);
            writer.releaseLock();
        });
    }
    tryRead() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const reader = this.sstreams.readable.getReader();
            try {
                yield this.read(reader);
            }
            catch (e) {
                console.warn(e);
                const writer = this.rstreams.writable.getWriter();
                writer.abort(e).catch(console.warn);
                writer.releaseLock();
                this.res.err(e);
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
                yield this.onRead(value);
            }
        });
    }
    onRead(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this.state.type === "none") {
                const result = yield this.onReadNone(chunk);
                if (!result)
                    return;
                chunk = result;
            }
            if (this.state.type !== "headed")
                return;
            if (this.state.transfer.type === "lengthed") {
                yield this.onReadLenghted(chunk);
                return;
            }
            if (this.state.transfer.type === "chunked") {
                yield this.onReadChunked(chunk);
                return;
            }
        });
    }
    getTransferFromHeaders(headers) {
        const type = headers.get("transfer-encoding");
        if (type === "chunked") {
            const buffer = binary.Binary.allocUnsafe(10 * 1024);
            return { type, buffer };
        }
        if (type === null) {
            const length = Number(headers.get("content-length"));
            return { type: "lengthed", offset: 0, length };
        }
        throw new Error(`Unsupported transfer ${type}`);
    }
    getCompressionFromHeaders(headers) {
        const type = headers.get("content-encoding");
        if (type === "gzip") {
            const decoder = new foras.GzDecoder();
            return { type, decoder };
        }
        if (type === null) {
            return { type: "none" };
        }
        throw new Error(`Unsupported compression ${type}`);
    }
    onReadNone(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this.state.type !== "none")
                return;
            const { buffer } = this.state;
            buffer.write(chunk);
            const split = buffer.buffer.indexOf("\r\n\r\n");
            if (split === -1)
                return;
            const head = buffer.buffer.subarray(0, split);
            const body = buffer.buffer.subarray(split + "\r\n\r\n".length, buffer.offset);
            const [info, ...rawHeaders] = head.toString().split("\r\n");
            const [version, statusString, statusText] = info.split(" ");
            const status = Number(statusString);
            const headers = new Headers(rawHeaders.map(it => strings.Strings.splitOnce(it, ": ")));
            this.res.ok(new Response(this.rstreams.readable, { headers, status, statusText }));
            const transfer = this.getTransferFromHeaders(headers);
            const compression = this.getCompressionFromHeaders(headers);
            this.state = { type: "headed", version, transfer, compression };
            return body;
        });
    }
    onReadLenghted(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this.state.type !== "headed")
                return;
            if (this.state.transfer.type !== "lengthed")
                return;
            const { transfer, compression } = this.state;
            transfer.offset += chunk.length;
            if (transfer.offset > transfer.length)
                throw new Error(`Length > Content-Length`);
            const writer = this.rstreams.writable.getWriter();
            if (compression.type === "none") {
                writer.write(chunk).catch(console.warn);
            }
            else if (compression.type === "gzip") {
                compression.decoder.write(chunk);
                compression.decoder.flush();
                const dchunk = compression.decoder.read();
                const bdchunk = Buffer.from(dchunk.buffer);
                writer.write(bdchunk).catch(console.warn);
            }
            if (transfer.offset === transfer.length) {
                if (compression.type === "gzip") {
                    const fchunk = compression.decoder.finish();
                    const bfchunk = Buffer.from(fchunk.buffer);
                    writer.write(bfchunk).catch(console.warn);
                }
                writer.close().catch(console.warn);
            }
            writer.releaseLock();
        });
    }
    onReadChunked(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            if (this.state.type !== "headed")
                return;
            if (this.state.transfer.type !== "chunked")
                return;
            const { transfer, compression } = this.state;
            const { buffer } = transfer;
            buffer.write(chunk);
            let slice = buffer.buffer.subarray(0, buffer.offset);
            while (slice.length) {
                const index = slice.indexOf("\r\n");
                // [...] => partial header => wait
                if (index === -1)
                    return;
                // [length]\r\n(...) => full header => split it
                const length = parseInt(slice.subarray(0, index).toString(), 16);
                const rest = slice.subarray(index + 2);
                if (length === 0) {
                    const writer = this.rstreams.writable.getWriter();
                    if (compression.type === "gzip") {
                        const fchunk = compression.decoder.finish();
                        const bfchunk = Buffer.from(fchunk.buffer);
                        writer.write(bfchunk).catch(console.warn);
                    }
                    writer.close().catch(console.warn);
                    writer.releaseLock();
                    return;
                }
                // len(...) < length + len(\r\n) => partial chunk => wait
                if (rest.length < length + 2)
                    break;
                // ([length]\r\n)[chunk]\r\n(...) => full chunk => split it
                const chunk2 = rest.subarray(0, length);
                const rest2 = rest.subarray(length + 2);
                const writer = this.rstreams.writable.getWriter();
                if (compression.type === "none") {
                    writer.write(chunk2).catch(console.warn);
                }
                else if (compression.type === "gzip") {
                    compression.decoder.write(chunk2);
                    compression.decoder.flush();
                    const dchunk2 = compression.decoder.read();
                    const bdchunk2 = Buffer.from(dchunk2.buffer);
                    writer.write(bdchunk2).catch(console.warn);
                }
                writer.releaseLock();
                buffer.offset = 0;
                buffer.write(rest2);
                slice = buffer.buffer.subarray(0, buffer.offset);
            }
        });
    }
}

exports.HttpStream = HttpStream;
//# sourceMappingURL=http.cjs.map
