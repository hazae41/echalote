import { Binary } from '../../../libs/binary.js';

declare class TypedAddress {
    readonly type: number;
    readonly value: Buffer;
    readonly class: typeof TypedAddress;
    static IPv4: number;
    static IPv6: number;
    constructor(type: number, value: Buffer);
    write(binary: Binary): void;
    static read(binary: Binary): TypedAddress;
}
declare class Address4 {
    readonly address: string;
    readonly class: typeof Address4;
    /**
     * IPv4 address
     * @param address xxx.xxx.xxx.xxx
     */
    constructor(address: string);
    write(binary: Binary): void;
    static read(binary: Binary): Address4;
}
declare class Address6 {
    readonly address: string;
    readonly class: typeof Address6;
    /**
     * IPv6 address
     * @param address [xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]
     */
    constructor(address: string);
    write(binary: Binary): void;
    static read(binary: Binary): Address6;
}

export { Address4, Address6, TypedAddress };
