import { Tls } from './tls.js';
import { tls } from 'node-forge';

declare class TlsOverHttp extends Tls {
    readonly info: RequestInfo;
    readonly class: typeof TlsOverHttp;
    readonly connection: tls.Connection;
    private queue;
    constructor(info: RequestInfo);
    fetchAll(): Promise<void>;
    fetch(body?: Buffer): Promise<void>;
}

export { TlsOverHttp };
