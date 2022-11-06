import { NewCell } from '../../cell.js';

declare class AuthChallengeCell {
    readonly circuit: undefined;
    readonly challenge: Buffer;
    readonly methods: number[];
    readonly class: typeof AuthChallengeCell;
    static command: number;
    constructor(circuit: undefined, challenge: Buffer, methods: number[]);
    pack(): Buffer;
    cell(): NewCell;
    static uncell(cell: NewCell): AuthChallengeCell;
}

export { AuthChallengeCell };
