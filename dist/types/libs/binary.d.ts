declare class Binary {
    buffer: Buffer;
    readonly class: typeof Binary;
    offset: number;
    constructor(buffer: Buffer);
    static alloc(length: number): Binary;
    static allocUnsafe(length: number): Binary;
    get remaining(): number;
    get sliced(): Buffer;
    read(length: number, shallow?: boolean): Buffer;
    write(array: Buffer, shallow?: boolean): void;
    fill(end?: number): void;
    readUint8(shallow?: boolean): number;
    writeUint8(x: number, shallow?: boolean): void;
    readUint16(shallow?: boolean): number;
    writeUint16(x: number, shallow?: boolean): void;
    readUint32(shallow?: boolean): number;
    writeUint32(x: number, shallow?: boolean): void;
    readString(length: number): string;
    writeString(text: string): void;
    readNull(): Buffer;
    writeNull(array: Buffer): void;
    readNullString(): string;
    writeNullString(text: string): void;
    reread(offset: number): Buffer;
    split(length: number): Buffer[];
}

export { Binary };
