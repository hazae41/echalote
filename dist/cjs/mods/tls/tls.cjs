'use strict';

var tslib = require('tslib');
var future = require('../../libs/future.cjs');

class Tls extends EventTarget {
    constructor() {
        super(...arguments);
        this._closed = false;
    }
    get closed() {
        return this._closed;
    }
    send(array) {
        const binary = array.toString("binary");
        this.connection.prepare(binary);
    }
    waitOpen() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const future$1 = new future.Future();
            try {
                this.addEventListener("close", future$1.err, { passive: true });
                this.addEventListener("error", future$1.err, { passive: true });
                this.addEventListener("open", future$1.ok, { passive: true });
                yield future$1.promise;
            }
            finally {
                this.removeEventListener("error", future$1.err);
                this.removeEventListener("close", future$1.err);
                this.removeEventListener("open", future$1.ok);
            }
        });
    }
    open() {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            const wait = this.waitOpen();
            this.connection.handshake();
            yield wait;
        });
    }
}

exports.Tls = Tls;
//# sourceMappingURL=tls.cjs.map
