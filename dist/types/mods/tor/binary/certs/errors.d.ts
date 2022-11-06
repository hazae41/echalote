declare class Duplicated extends Error {
    readonly type: number;
    constructor(type: number);
}

export { Duplicated };
