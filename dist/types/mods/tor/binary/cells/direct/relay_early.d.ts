import { RelayCell } from './relay.js';

declare class RelayEarlyCell extends RelayCell {
    readonly class: typeof RelayEarlyCell;
    static command: number;
}

export { RelayEarlyCell };
