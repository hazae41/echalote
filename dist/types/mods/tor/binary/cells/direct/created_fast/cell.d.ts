import { NewCell } from '../../cell.js';
import { Circuit } from '../../../../circuit.js';

declare class CreatedFastCell {
    readonly circuit: Circuit;
    readonly material: Buffer;
    readonly derivative: Buffer;
    readonly class: typeof CreatedFastCell;
    static command: number;
    constructor(circuit: Circuit, material: Buffer, derivative: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): CreatedFastCell;
}

export { CreatedFastCell };
