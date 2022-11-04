declare class Bitmask {
    n: number;
    readonly class: typeof Bitmask;
    constructor(n: number);
    get(i: number): boolean;
    set(i: number, x: boolean): this;
    export(): number;
}

export { Bitmask };
