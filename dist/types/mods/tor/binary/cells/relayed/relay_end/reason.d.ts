import { Binary } from '../../../../../../libs/binary.js';
import { Address4, Address6 } from '../../../address.js';

declare type RelayEndReason = RelayEndReasonExitPolicy | RelayEndReasonOther;
declare class RelayEndReasonOther {
    readonly id: number;
    readonly class: typeof RelayEndReasonOther;
    constructor(id: number);
    write(binary: Binary): void;
}
declare class RelayEndReasonExitPolicy {
    readonly address: Address4 | Address6;
    readonly ttl: Date;
    readonly class: typeof RelayEndReasonExitPolicy;
    static id: number;
    constructor(address: Address4 | Address6, ttl: Date);
    get id(): number;
    write(binary: Binary): void;
    static read(binary: Binary): RelayEndReasonExitPolicy;
}

export { RelayEndReason, RelayEndReasonExitPolicy, RelayEndReasonOther };
