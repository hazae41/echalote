import { NewCell } from '../../cell.js';
import { Cert as Cert$1 } from '../../../certs/cross/cert.js';
import { Cert as Cert$2 } from '../../../certs/ed25519/cert.js';
import { Cert } from '../../../certs/rsa/cert.js';

interface Certs {
    id?: Cert;
    id_to_tls?: Cert;
    id_to_auth?: Cert;
    id_to_eid?: Cert$1;
    eid_to_signing?: Cert$2;
    signing_to_tls?: Cert$2;
    signing_to_auth?: Cert$2;
}
declare class CertsCell {
    readonly circuit: undefined;
    readonly certs: Certs;
    readonly class: typeof CertsCell;
    static command: number;
    constructor(circuit: undefined, certs: Certs);
    pack(): Buffer;
    getIdHash(): Promise<Buffer>;
    checkId(): Promise<void>;
    checkIdToTls(): Promise<void>;
    checkIdToEid(): Promise<void>;
    checkEidToSigning(): void;
    checkSigningToTls(): void;
    cell(): NewCell;
    static uncell(cell: NewCell): CertsCell;
}

export { Certs, CertsCell };
