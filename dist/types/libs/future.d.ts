/**
 * Promise that's manually fullfilled or rejected
 */
declare class Future<T = any, E = any> {
    readonly class: typeof Future;
    readonly ok: (x: T) => void;
    readonly err: (e: E) => void;
    readonly promise: Promise<T>;
    constructor();
}

export { Future };
