import { Binary } from '../../../../libs/binary.js';
import { Circuit } from '../../circuit.js';
import { Tor } from '../../tor.js';

declare type Cell = OldCell | NewCell;
interface OldCellRaw {
    type: "old";
    circuitId: number;
    command: number;
    payload: Buffer;
}
interface NewCellRaw {
    type: "new";
    circuitId: number;
    command: number;
    payload: Buffer;
}
declare class OldCell {
    readonly circuit: Circuit | undefined;
    readonly command: number;
    readonly payload: Buffer;
    readonly class: typeof OldCell;
    constructor(circuit: Circuit | undefined, command: number, payload: Buffer);
    pack(): Buffer;
    static tryRead(binary: Binary): OldCellRaw | undefined;
    static unpack(tor: Tor, raw: OldCellRaw): OldCell;
}
declare class NewCell {
    readonly circuit: Circuit | undefined;
    readonly command: number;
    readonly payload: Buffer;
    readonly class: typeof NewCell;
    constructor(circuit: Circuit | undefined, command: number, payload: Buffer);
    pack(): Buffer;
    static tryRead(binary: Binary): NewCellRaw | undefined;
    static unpack(tor: Tor, raw: NewCellRaw): NewCell;
}

export { Cell, NewCell, NewCellRaw, OldCell, OldCellRaw };
