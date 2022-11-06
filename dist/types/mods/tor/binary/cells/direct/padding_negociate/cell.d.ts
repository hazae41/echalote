import { NewCell } from '../../cell.js';

declare class PaddingNegociateCell {
    readonly circuit: undefined;
    readonly version: number;
    readonly pcommand: number;
    readonly ito_low_ms: number;
    readonly ito_high_ms: number;
    readonly class: typeof PaddingNegociateCell;
    static command: number;
    static versions: {
        ZERO: number;
    };
    static commands: {
        STOP: number;
        START: number;
    };
    constructor(circuit: undefined, version: number, pcommand: number, ito_low_ms: number, ito_high_ms: number);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): PaddingNegociateCell;
}

export { PaddingNegociateCell };
