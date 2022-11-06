import { RelayCell } from '../direct/relay/cell.js';
import { Circuit } from '../../../circuit.js';
import { TcpStream } from '../../../streams/tcp.js';

declare class RelayDataCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream;
    readonly data: Buffer;
    readonly class: typeof RelayDataCell;
    static rcommand: number;
    constructor(circuit: Circuit, stream: TcpStream, data: Buffer);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayDataCell;
}

export { RelayDataCell };
