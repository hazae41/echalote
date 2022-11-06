import { NewCell } from '../../cell.js';
import { Circuit } from '../../../../circuit.js';
import { TcpStream } from '../../../../streams/tcp.js';

declare class RelayCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream | undefined;
    readonly rcommand: number;
    readonly data: Buffer;
    readonly class: typeof RelayCell;
    static command: number;
    constructor(circuit: Circuit, stream: TcpStream | undefined, rcommand: number, data: Buffer);
    pack(): Promise<Buffer>;
    cell(): Promise<NewCell>;
    static uncell(cell: NewCell): Promise<RelayCell>;
}

export { RelayCell };
