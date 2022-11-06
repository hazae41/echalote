'use strict';

class Duplicated extends Error {
    constructor(type) {
        super(`Found duplicate certificate type ${type}`);
        this.type = type;
    }
}

exports.Duplicated = Duplicated;
//# sourceMappingURL=errors.cjs.map
