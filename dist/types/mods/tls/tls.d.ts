import { tls } from 'node-forge';

declare abstract class Tls extends EventTarget {
    readonly abstract connection: tls.Connection;
    protected _closed: boolean;
    get closed(): boolean;
    send(array: Buffer): void;
    private waitOpen;
    open(): Promise<void>;
}

export { Tls };
