'use strict';

var relay = require('./relay.cjs');

class RelayEarlyCell extends relay.RelayCell {
    constructor() {
        super(...arguments);
        this.class = RelayEarlyCell;
    }
}
RelayEarlyCell.command = 9;

exports.RelayEarlyCell = RelayEarlyCell;
//# sourceMappingURL=relay_early.cjs.map
