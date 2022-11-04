import { Binary } from '../../../../../libs/binary.js';
import { Cert as Cert$1 } from '../cert.js';

declare class Cert implements Cert$1 {
    readonly type: number;
    readonly key: Buffer;
    readonly expiration: Date;
    readonly payload: Buffer;
    readonly signature: Buffer;
    readonly class: typeof Cert;
    static types: {
        ID_TO_EID: number;
    };
    constructor(type: number, key: Buffer, expiration: Date, payload: Buffer, signature: Buffer);
    write(binary: Binary): void;
    check(): void;
    static read(binary: Binary, type: number, length: number): Cert;
}

export { Cert };
