import { OldCell } from '../cell.js';

declare class VersionsCell {
    readonly circuit: undefined;
    readonly versions: number[];
    readonly class: typeof VersionsCell;
    static command: number;
    constructor(circuit: undefined, versions: number[]);
    pack(): Buffer;
    cell(): OldCell;
    static uncell(cell: OldCell): VersionsCell;
}

export { VersionsCell };
