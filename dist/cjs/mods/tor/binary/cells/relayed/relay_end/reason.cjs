'use strict';

var time = require('../../../../../../libs/time.cjs');
var address = require('../../../address.cjs');

class RelayEndReasonOther {
    constructor(id) {
        this.id = id;
        this.class = RelayEndReasonOther;
    }
    write(binary) { }
}
class RelayEndReasonExitPolicy {
    constructor(address, ttl) {
        this.address = address;
        this.ttl = ttl;
        this.class = RelayEndReasonExitPolicy;
    }
    get id() {
        return this.class.id;
    }
    write(binary) {
        this.address.write(binary);
        binary.writeUint32(time.dateToTtl(this.ttl));
    }
    static read(binary) {
        const address$1 = binary.remaining === 8
            ? address.Address4.read(binary)
            : address.Address6.read(binary);
        const ttl = time.ttlToDate(binary.readUint32());
        return new this(address$1, ttl);
    }
}
RelayEndReasonExitPolicy.id = 4;

exports.RelayEndReasonExitPolicy = RelayEndReasonExitPolicy;
exports.RelayEndReasonOther = RelayEndReasonOther;
//# sourceMappingURL=reason.cjs.map
