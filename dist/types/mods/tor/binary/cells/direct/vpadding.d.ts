import { NewCell } from '../cell.js';

declare class VariablePaddingCell {
    readonly circuit: undefined;
    readonly data: Buffer;
    readonly class: typeof VariablePaddingCell;
    static command: number;
    constructor(circuit: undefined, data?: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): VariablePaddingCell;
}

export { VariablePaddingCell };
