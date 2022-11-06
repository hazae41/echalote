import { RelayCell } from '../direct/relay/cell.js';
import { Circuit } from '../../../circuit.js';

declare class RelayTruncatedCell {
    readonly circuit: Circuit;
    readonly stream: undefined;
    readonly reason: number;
    readonly class: typeof RelayTruncatedCell;
    static rcommand: number;
    static reasons: {
        NONE: number;
        PROTOCOL: number;
        INTERNAL: number;
        REQUESTED: number;
        HIBERNATING: number;
        RESOURCELIMIT: number;
        CONNECTFAILED: number;
        OR_IDENTITY: number;
        CHANNEL_CLOSED: number;
        FINISHED: number;
        TIMEOUT: number;
        DESTROYED: number;
        NOSUCHSERVICE: number;
    };
    constructor(circuit: Circuit, stream: undefined, reason: number);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayTruncatedCell;
}

export { RelayTruncatedCell };
