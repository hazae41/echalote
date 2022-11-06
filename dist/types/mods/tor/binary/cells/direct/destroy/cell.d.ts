import { NewCell } from '../../cell.js';
import { Circuit } from '../../../../circuit.js';

declare class DestroyCell {
    readonly circuit: Circuit;
    readonly reason: number;
    readonly class: typeof DestroyCell;
    static command: number;
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
    constructor(circuit: Circuit, reason: number);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): DestroyCell;
}

export { DestroyCell };
