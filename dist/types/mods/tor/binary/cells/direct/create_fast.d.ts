import { NewCell } from '../cell.js';
import { Circuit } from '../../../circuit.js';

declare class CreateFastCell {
    readonly circuit: Circuit;
    readonly material: Buffer;
    readonly class: typeof CreateFastCell;
    static command: number;
    /**
     * The CREATE_FAST cell
     * @param material Key material (X) [20]
     */
    constructor(circuit: Circuit, material: Buffer);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): CreateFastCell;
}

export { CreateFastCell };
