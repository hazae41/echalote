import { Circuit } from '../../circuit.js';
import { TcpStream } from '../../streams/tcp.js';

declare class InvalidCommand extends Error {
    readonly name: string;
    readonly command: number;
    constructor(name: string, command: number);
}
declare class InvalidRelayCommand extends Error {
    readonly name: string;
    readonly command: number;
    constructor(name: string, command: number);
}
declare class InvalidCircuit extends Error {
    readonly name: string;
    readonly circuit?: Circuit | undefined;
    constructor(name: string, circuit?: Circuit | undefined);
}
declare class InvalidStream extends Error {
    readonly name: string;
    readonly stream?: TcpStream | undefined;
    constructor(name: string, stream?: TcpStream | undefined);
}

export { InvalidCircuit, InvalidCommand, InvalidRelayCommand, InvalidStream };
