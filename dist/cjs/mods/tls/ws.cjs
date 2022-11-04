'use strict';

var tslib = require('tslib');
var forge = require('../../libs/forge.cjs');
var tls = require('./tls.cjs');

class TlsOverWs extends tls.Tls {
    constructor(socket) {
        super();
        this.socket = socket;
        this.class = TlsOverWs;
        socket.addEventListener("message", (e) => tslib.__awaiter(this, void 0, void 0, function* () {
            const buffer = Buffer.from(yield e.data.arrayBuffer());
            this.connection.process(buffer.toString("binary"));
        }), { passive: true });
        this.connection = window.forge.tls.createConnection({
            server: false,
            cipherSuites: Object.values(forge.fixedCiphersuites),
            verify: (connection, verified, depth, certs) => {
                return true;
            },
            connected: (connection) => {
                this.dispatchEvent(new Event("open"));
            },
            tlsDataReady: (connection) => {
                const bytes = connection.tlsData.getBytes();
                const data = Buffer.from(bytes, "binary");
                this.socket.send(data);
            },
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
}

exports.TlsOverWs = TlsOverWs;
//# sourceMappingURL=ws.cjs.map
