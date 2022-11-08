'use strict';

var tslib = require('tslib');
var forge = require('../../libs/forge.cjs');
var tls = require('./tls.cjs');

class TlsOverHttp extends tls.Tls {
    constructor(info) {
        super();
        this.info = info;
        this.class = TlsOverHttp;
        this.queue = new Array();
        setInterval(() => {
            if (!this.queue.length)
                return;
            this.fetchAll().catch(console.warn);
        }, 100);
        setInterval(() => {
            this.fetch().catch(console.warn);
        }, 1000);
        this.connection = window.forge.tls.createConnection({
            server: false,
            cipherSuites: Object.values(forge.fixedCiphersuites),
            verify: (connection, verified, depth, certs) => {
                return true;
            },
            connected: (connection) => {
                this.dispatchEvent(new Event("open"));
            },
            tlsDataReady: (connection) => tslib.__awaiter(this, void 0, void 0, function* () {
                const bytes = connection.tlsData.getBytes();
                this.queue.push(Buffer.from(bytes, "binary"));
            }),
            dataReady: (connection) => {
                const bytes = connection.data.getBytes();
                const data = Buffer.from(bytes, "binary");
                const event = new MessageEvent("message", { data });
                if (!this.dispatchEvent(event))
                    return;
            },
            closed: (connection) => {
                const event = new CloseEvent("close");
                if (!this.dispatchEvent(event))
                    return;
                this._closed = true;
            },
            error: (connection, error) => {
                const event = new ErrorEvent("error", { error });
                if (!this.dispatchEvent(event))
                    return;
            }
        });
    }
    fetchAll() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const body = Buffer.concat(this.queue);
            this.queue = [];
            yield this.fetch(body);
        });
    }
    fetch(body) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const res = yield fetch(this.info, { method: "POST", body });
            // if (!res.ok) {
            //   const error = new Error(await res.text())
            //   const event = new ErrorEvent("error", { error })
            //   if (!this.dispatchEvent(event)) return
            //   return
            // }
            const buffer = Buffer.from(yield res.arrayBuffer());
            this.connection.process(buffer.toString("binary"));
        });
    }
}

exports.TlsOverHttp = TlsOverHttp;
//# sourceMappingURL=http.cjs.map
