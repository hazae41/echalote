import { Address4, Address6 } from '../../../address.js';
import { RelayCell } from '../../direct/relay/cell.js';
import { Circuit } from '../../../../circuit.js';
import { TcpStream } from '../../../../streams/tcp.js';

declare class RelayConnectedCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream;
    readonly address: Address4 | Address6;
    readonly ttl: Date;
    readonly class: typeof RelayConnectedCell;
    static rcommand: number;
    constructor(circuit: Circuit, stream: TcpStream, address: Address4 | Address6, ttl: Date);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayConnectedCell;
}

export { RelayConnectedCell };
