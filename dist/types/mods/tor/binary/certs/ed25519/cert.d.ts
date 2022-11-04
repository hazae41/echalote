import { Binary } from '../../../../../libs/binary.js';
import { Cert as Cert$1 } from '../cert.js';
import { SignedWithEd25519Key } from './extensions/signer.js';

interface Extensions {
    signer?: SignedWithEd25519Key;
}
declare class Cert implements Cert$1 {
    readonly type: number;
    readonly version: number;
    readonly certType: number;
    readonly expiration: Date;
    readonly certKeyType: number;
    readonly certKey: Buffer;
    readonly extensions: Extensions;
    readonly payload: Buffer;
    readonly signature: Buffer;
    readonly class: typeof Cert;
    static types: {
        EID_TO_SIGNING: number;
        SIGNING_TO_TLS: number;
        SIGNING_TO_AUTH: number;
    };
    static flags: {
        AFFECTS_VALIDATION: number;
    };
    constructor(type: number, version: number, certType: number, expiration: Date, certKeyType: number, certKey: Buffer, extensions: Extensions, payload: Buffer, signature: Buffer);
    write(binary: Binary): void;
    check(): void;
    static read(binary: Binary, type: number, length: number): Cert;
}

export { Cert, Extensions };
