import { TypedAddress } from '../../../address.js';
import { NewCell } from '../../cell.js';

declare class NetinfoCell {
    readonly circuit: undefined;
    readonly time: number;
    readonly other: TypedAddress;
    readonly owneds: TypedAddress[];
    readonly class: typeof NetinfoCell;
    static command: number;
    constructor(circuit: undefined, time: number, other: TypedAddress, owneds: TypedAddress[]);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): NetinfoCell;
}

export { NetinfoCell };
