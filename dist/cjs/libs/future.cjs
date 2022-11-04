'use strict';

/**
 * Promise that's manually fullfilled or rejected
 */
class Future {
    constructor() {
        this.class = Future;
        let ok;
        let err;
        this.promise = new Promise((pok, perr) => {
            ok = pok;
            err = perr;
        });
        this.ok = ok;
        this.err = err;
    }
}

exports.Future = Future;
//# sourceMappingURL=future.cjs.map
