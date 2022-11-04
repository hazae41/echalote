import * as node_forge from 'node-forge';
import { Tls } from './tls.js';

declare class TlsOverHttp extends Tls {
    readonly info: RequestInfo;
    readonly class: typeof TlsOverHttp;
    readonly connection: node_forge.tls.Connection;
    constructor(info: RequestInfo);
    fetch(body?: Buffer): Promise<void>;
}

export { TlsOverHttp };
