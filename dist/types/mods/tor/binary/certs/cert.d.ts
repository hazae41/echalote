import { Binary } from '../../../../libs/binary.js';

interface Cert {
    readonly type: number;
    write(binary: Binary): void;
}

export { Cert };
