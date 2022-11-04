import { NewCell } from '../cell.js';
import { Circuit } from '../../../circuit.js';

declare class VariablePaddingCell {
    readonly circuit: Circuit | undefined;
    readonly data: Buffer;
    readonly class: typeof VariablePaddingCell;
    static command: number;
    constructor(circuit: Circuit | undefined, data?: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): VariablePaddingCell;
}

export { VariablePaddingCell };
