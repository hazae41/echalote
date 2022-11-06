import { Binary } from '../../../../../../libs/binary.js';

declare type RelayExtend2Link = RelayExtend2LinkIPv4 | RelayExtend2LinkIPv6 | RelayExtend2LinkLegacyID | RelayExtend2LinkModernID;
declare class RelayExtend2LinkIPv4 {
    readonly hostname: string;
    readonly port: number;
    readonly class: typeof RelayExtend2LinkIPv4;
    static type: number;
    constructor(hostname: string, port: number);
    write(binary: Binary): void;
    static from(host: string): RelayExtend2LinkIPv4;
}
declare class RelayExtend2LinkIPv6 {
    readonly hostname: string;
    readonly port: number;
    readonly class: typeof RelayExtend2LinkIPv6;
    static type: number;
    constructor(hostname: string, port: number);
    write(binary: Binary): void;
    static from(host: string): RelayExtend2LinkIPv6;
}
declare class RelayExtend2LinkLegacyID {
    readonly fingerprint: Buffer;
    readonly class: typeof RelayExtend2LinkLegacyID;
    static type: number;
    constructor(fingerprint: Buffer);
    write(binary: Binary): void;
}
declare class RelayExtend2LinkModernID {
    readonly fingerprint: Buffer;
    readonly class: typeof RelayExtend2LinkModernID;
    static type: number;
    constructor(fingerprint: Buffer);
    write(binary: Binary): void;
}

export { RelayExtend2Link, RelayExtend2LinkIPv4, RelayExtend2LinkIPv6, RelayExtend2LinkLegacyID, RelayExtend2LinkModernID };
