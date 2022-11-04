import { Binary } from '../../../../../libs/binary.js';
import { RelayEarlyCell } from '../direct/relay_early.js';
import { Circuit } from '../../../circuit.js';

declare type Link = LinkIPv4 | LinkIPv6 | LinkLegacyID | LinkModernID;
declare class LinkIPv4 {
    readonly hostname: string;
    readonly port: number;
    readonly class: typeof LinkIPv4;
    static type: number;
    constructor(hostname: string, port: number);
    write(binary: Binary): void;
    static from(host: string): LinkIPv4;
}
declare class LinkIPv6 {
    readonly hostname: string;
    readonly port: number;
    readonly class: typeof LinkIPv6;
    static type: number;
    constructor(hostname: string, port: number);
    write(binary: Binary): void;
    static from(host: string): LinkIPv6;
}
declare class LinkLegacyID {
    readonly fingerprint: Buffer;
    readonly class: typeof LinkLegacyID;
    static type: number;
    constructor(fingerprint: Buffer);
    write(binary: Binary): void;
}
declare class LinkModernID {
    readonly fingerprint: Buffer;
    readonly class: typeof LinkModernID;
    static type: number;
    constructor(fingerprint: Buffer);
    write(binary: Binary): void;
}
declare class RelayExtend2Cell {
    readonly circuit: Circuit;
    readonly stream: undefined;
    readonly type: number;
    readonly links: Link[];
    readonly data: Buffer;
    readonly class: typeof RelayExtend2Cell;
    static rcommand: number;
    static types: {
        /**
         * The old, slow, and insecure handshake
         * @deprecated
         */
        TAP: number;
        /**
         * The new, quick, and secure handshake
         */
        NTOR: number;
    };
    constructor(circuit: Circuit, stream: undefined, type: number, links: Link[], data: Buffer);
    pack(): Promise<Buffer>;
    cell(): RelayEarlyCell;
}

export { Link, LinkIPv4, LinkIPv6, LinkLegacyID, LinkModernID, RelayExtend2Cell };
