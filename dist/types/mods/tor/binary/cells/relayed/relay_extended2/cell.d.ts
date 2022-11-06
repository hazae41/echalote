import { RelayCell } from '../../direct/relay/cell.js';
import { Circuit } from '../../../../circuit.js';

declare class RelayExtended2Cell {
    readonly circuit: Circuit;
    readonly stream: undefined;
    readonly data: Buffer;
    readonly class: typeof RelayExtended2Cell;
    static rcommand: number;
    constructor(circuit: Circuit, stream: undefined, data: Buffer);
    pack(): Promise<Buffer>;
    cell(): RelayCell;
    static uncell(cell: RelayCell): RelayExtended2Cell;
}

export { RelayExtended2Cell };
