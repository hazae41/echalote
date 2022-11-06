import { RelayCell } from '../../direct/relay/cell.js';
import { Circuit } from '../../../../circuit.js';
import { TcpStream } from '../../../../streams/tcp.js';

declare class RelayBeginDirCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream;
    readonly class: typeof RelayBeginDirCell;
    static rcommand: number;
    constructor(circuit: Circuit, stream: TcpStream);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayBeginDirCell;
}

export { RelayBeginDirCell };
