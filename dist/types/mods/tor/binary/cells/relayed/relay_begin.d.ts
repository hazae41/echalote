import { Bitmask } from '../../../../../libs/bits.js';
import { RelayCell } from '../direct/relay/cell.js';
import { Circuit } from '../../../circuit.js';
import { TcpStream } from '../../../streams/tcp.js';

declare class RelayBeginCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream;
    readonly address: string;
    readonly flags: Bitmask;
    readonly class: typeof RelayBeginCell;
    static rcommand: number;
    static flags: {
        IPV4_OK: number;
        IPV6_NOT_OK: number;
        IPV6_PREFER: number;
    };
    constructor(circuit: Circuit, stream: TcpStream, address: string, flags: Bitmask);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayBeginCell;
}

export { RelayBeginCell };
