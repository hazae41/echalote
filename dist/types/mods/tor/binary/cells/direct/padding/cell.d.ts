import { NewCell } from '../../cell.js';

declare class PaddingCell {
    readonly circuit: undefined;
    readonly data: Buffer;
    readonly class: typeof PaddingCell;
    static command: number;
    constructor(circuit: undefined, data?: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): PaddingCell;
}

export { PaddingCell };
