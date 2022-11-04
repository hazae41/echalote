'use strict';

class Bitmask {
    constructor(n) {
        this.n = n;
        this.class = Bitmask;
    }
    get(i) {
        const mask = 1 << i;
        const masked = this.n & mask;
        return masked !== 0;
    }
    set(i, x) {
        const mask = 1 << i;
        if (x)
            this.n |= mask;
        else
            this.n &= ~mask;
        return this;
    }
    export() {
        return this.n >>> 0;
    }
}

exports.Bitmask = Bitmask;
//# sourceMappingURL=bits.cjs.map
