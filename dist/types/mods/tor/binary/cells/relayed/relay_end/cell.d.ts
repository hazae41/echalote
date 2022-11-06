import { Binary } from '../../../../../../libs/binary.js';
import { Address4, Address6 } from '../../../address.js';
import { RelayCell } from '../../direct/relay/cell.js';
import { Circuit } from '../../../../circuit.js';
import { TcpStream } from '../../../../streams/tcp.js';

declare type RelayEndCellReason = RelayEndCellReasonExitPolicy | RelayEndCellReasonOther;
declare class RelayEndCellReasonOther {
    readonly id: number;
    readonly class: typeof RelayEndCellReasonOther;
    constructor(id: number);
    write(binary: Binary): void;
}
declare class RelayEndCellReasonExitPolicy {
    readonly address: Address4 | Address6;
    readonly ttl: Date;
    readonly class: typeof RelayEndCellReasonExitPolicy;
    static id: number;
    constructor(address: Address4 | Address6, ttl: Date);
    get id(): number;
    write(binary: Binary): void;
    static read(binary: Binary): RelayEndCellReasonExitPolicy;
}
declare class RelayEndCell {
    readonly circuit: Circuit;
    readonly stream: TcpStream;
    readonly reason: RelayEndCellReason;
    readonly class: typeof RelayEndCell;
    static rcommand: number;
    static reasons: {
        readonly REASON_UNKNOWN: 0;
        readonly REASON_MISC: 1;
        readonly REASON_RESOLVEFAILED: 2;
        readonly REASON_CONNECTREFUSED: 3;
        readonly REASON_EXITPOLICY: 4;
        readonly REASON_DESTROY: 5;
        readonly REASON_DONE: 6;
        readonly REASON_TIMEOUT: 7;
        readonly REASON_NOROUTE: 8;
        readonly REASON_HIBERNATING: 9;
        readonly REASON_INTERNAL: 10;
        readonly REASON_RESOURCELIMIT: 11;
        readonly REASON_CONNRESET: 12;
        readonly REASON_TORPROTOCOL: 13;
        readonly REASON_NOTDIRECTORY: 14;
    };
    constructor(circuit: Circuit, stream: TcpStream, reason: RelayEndCellReason);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayEndCell;
}

export { RelayEndCell, RelayEndCellReason, RelayEndCellReasonExitPolicy, RelayEndCellReasonOther };
