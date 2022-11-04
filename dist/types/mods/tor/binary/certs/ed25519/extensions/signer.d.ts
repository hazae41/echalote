import { Binary } from '../../../../../../libs/binary.js';
import { Cert } from '../cert.js';
import { Extension } from './extension.js';

declare class SignedWithEd25519Key implements Extension {
    readonly length: number;
    readonly flags: number;
    readonly key: Buffer;
    readonly class: typeof SignedWithEd25519Key;
    static type: number;
    constructor(length: number, flags: number, key: Buffer);
    get type(): number;
    check(cert: Cert): void;
    write(binary: Binary): void;
    static read(binary: Binary, length: number, flags: number): SignedWithEd25519Key;
}

export { SignedWithEd25519Key };
