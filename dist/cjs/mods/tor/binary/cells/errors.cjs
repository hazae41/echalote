'use strict';

class InvalidCommand extends Error {
    constructor(name, command) {
        super(`Invalid ${name} command ${command}`);
        this.name = name;
        this.command = command;
    }
}
class InvalidRelayCommand extends Error {
    constructor(name, command) {
        super(`Invalid ${name} relay command ${command}`);
        this.name = name;
        this.command = command;
    }
}
class InvalidCircuit extends Error {
    constructor(name, circuit) {
        super(`Invalid ${name} circuit ${circuit === null || circuit === void 0 ? void 0 : circuit.id}`);
        this.name = name;
        this.circuit = circuit;
    }
}
class InvalidStream extends Error {
    constructor(name, stream) {
        super(`Invalid ${name} circuit ${stream === null || stream === void 0 ? void 0 : stream.id}`);
        this.name = name;
        this.stream = stream;
    }
}

exports.InvalidCircuit = InvalidCircuit;
exports.InvalidCommand = InvalidCommand;
exports.InvalidRelayCommand = InvalidRelayCommand;
exports.InvalidStream = InvalidStream;
//# sourceMappingURL=errors.cjs.map
