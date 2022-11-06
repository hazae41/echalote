'use strict';

var cell = require('../relay/cell.cjs');

class RelayEarlyCell extends cell.RelayCell {
    constructor() {
        super(...arguments);
        this.class = RelayEarlyCell;
    }
}
RelayEarlyCell.command = 9;

exports.RelayEarlyCell = RelayEarlyCell;
//# sourceMappingURL=cell.cjs.map
