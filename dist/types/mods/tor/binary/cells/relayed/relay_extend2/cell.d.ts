import { RelayEarlyCell } from '../../direct/relay_early/cell.js';
import { RelayExtend2Link } from './link.js';
import { Circuit } from '../../../../circuit.js';

declare class RelayExtend2Cell {
    readonly circuit: Circuit;
    readonly stream: undefined;
    readonly type: number;
    readonly links: RelayExtend2Link[];
    readonly data: Buffer;
    readonly class: typeof RelayExtend2Cell;
    static rcommand: number;
    static types: {
        /**
         * The old, slow, and insecure handshake
         * @deprecated
         */
        TAP: number;
        /**
         * The new, quick, and secure handshake
         */
        NTOR: number;
    };
    constructor(circuit: Circuit, stream: undefined, type: number, links: RelayExtend2Link[], data: Buffer);
    pack(): Promise<Buffer>;
    cell(): RelayEarlyCell;
}

export { RelayExtend2Cell };
