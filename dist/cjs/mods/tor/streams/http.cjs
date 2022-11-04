'use strict';

var tslib = require('tslib');
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
            req.body.pipeTo(this.wstreams.writable);
        else
            this.wstreams.writable.close();
        this.tryRead().catch(console.error);
        this.tryWrite().catch(console.error);
    }
    tryWrite() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const reader = this.wstreams.readable.getReader();
            try {
                yield this.write(reader);
            }
            catch (e) {
                console.error(e);
                const writer = this.sstreams.writable.getWriter();
                writer.abort(e);
                writer.releaseLock();
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
            if (this.req.signal.aborted)
                return;
            yield this.onWriteEnd();
        });
    }
    onWriteStart() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            let head = `${this.req.method} ${this.url.pathname} HTTP/1.1\r\n`;
            head += `Host: ${this.url.host}\r\n`;
            head += `Transfer-Encoding: chunked\r\n`;
            this.req.headers.forEach((v, k) => head += `${k}: ${v}\r\n`);
            head += `\r\n`;
            const writer = this.sstreams.writable.getWriter();
            writer.write(Buffer.from(head));
            writer.releaseLock();
        });
    }
    onWrite(chunk) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const length = chunk.length.toString(16);
            const line = `${length}\r\n${chunk.toString()}\r\n`;
            const writer = this.sstreams.writable.getWriter();
            writer.write(Buffer.from(line));
            writer.releaseLock();
        });
    }
    onWriteEnd() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.from(`0\r\n\r\n\r\n`);
            const writer = this.sstreams.writable.getWriter();
            writer.write(buffer);
            writer.close();
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
                console.error(e);
                const writer = this.rstreams.writable.getWriter();
                writer.abort(e);
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
                const encoding = headers.get("transfer-encoding");
                if (encoding === "chunked") {
                    const encoding = { type: "chunked", buffer: binary.Binary.allocUnsafe(10 * 1024) };
                    this.state = { type: "headed", version, encoding, length: 0 };
                }
                else if (encoding === null) {
                    const length = Number(headers.get("content-length"));
                    const encoding = { type: "lengthed", length };
                    this.state = { type: "headed", version, encoding, length: 0 };
                }
                else {
                    throw new Error(`Unsupported encoding ${encoding}`);
                }
                chunk = body;
            }
            if (this.state.encoding.type === "lengthed") {
                const writer = this.rstreams.writable.getWriter();
                writer.write(chunk);
                writer.releaseLock();
                this.state.length += chunk.length;
                if (this.state.length > this.state.encoding.length)
                    console.warn(`Length > Content-Length`);
                if (this.state.length >= this.state.encoding.length) {
                    const writer = this.rstreams.writable.getWriter();
                    writer.close();
                    writer.releaseLock();
                    return;
                }
            }
            if (this.state.encoding.type === "chunked") {
                const { buffer } = this.state.encoding;
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
                        writer.close();
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
                    writer.write(chunk2);
                    writer.releaseLock();
                    buffer.offset = 0;
                    buffer.write(rest2);
                    slice = buffer.buffer.subarray(0, buffer.offset);
                }
                return;
            }
        });
    }
}

exports.HttpStream = HttpStream;
//# sourceMappingURL=http.cjs.map
