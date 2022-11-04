'use strict';

class Target {
    constructor(idHash, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey) {
        this.idHash = idHash;
        this.circuit = circuit;
        this.forwardDigest = forwardDigest;
        this.backwardDigest = backwardDigest;
        this.forwardKey = forwardKey;
        this.backwardKey = backwardKey;
        this.class = Target;
    }
}

exports.Target = Target;
//# sourceMappingURL=target.cjs.map
