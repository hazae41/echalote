import { NewCell } from '../cell.js';
import { Circuit } from '../../../circuit.js';

declare class PaddingCell {
    readonly circuit: Circuit | undefined;
    readonly data: Buffer;
    readonly class: typeof PaddingCell;
    static command: number;
    constructor(circuit: Circuit | undefined, data?: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): PaddingCell;
}

export { PaddingCell };
