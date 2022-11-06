import { RelayCell } from '../direct/relay/cell.js';
import { Circuit } from '../../../circuit.js';
import { TcpStream } from '../../../streams/tcp.js';

declare class RelayDropCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream | undefined;
    readonly data: Buffer;
    readonly class: typeof RelayDropCell;
    static rcommand: number;
    constructor(circuit: Circuit, stream: TcpStream | undefined, data: Buffer);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayDropCell;
}

export { RelayDropCell };
