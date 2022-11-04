import { X509Certificate } from '@peculiar/x509';
import { Binary } from '../../../../../libs/binary.js';
import { Cert as Cert$1 } from '../cert.js';

declare class Cert implements Cert$1 {
    readonly type: number;
    readonly data: Buffer;
    readonly cert: X509Certificate;
    readonly class: typeof Cert;
    static types: {
        ID: number;
        ID_TO_TLS: number;
        ID_TO_AUTH: number;
    };
    constructor(type: number, data: Buffer, cert: X509Certificate);
    write(binary: Binary): void;
    check(): void;
    static read(binary: Binary, type: number, length: number): Cert;
}

export { Cert };
