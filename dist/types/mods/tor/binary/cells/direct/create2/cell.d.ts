import { NewCell } from '../../cell.js';
import { Circuit } from '../../../../circuit.js';

declare class Create2Cell {
    readonly circuit: Circuit;
    readonly type: number;
    readonly data: Buffer;
    readonly class: typeof Create2Cell;
    static command: number;
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
    constructor(circuit: Circuit, type: number, data: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): Create2Cell;
}

export { Create2Cell };
