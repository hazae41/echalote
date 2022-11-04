import * as node_forge from 'node-forge';
import { Tls } from './tls.js';

declare class TlsOverWs extends Tls {
    readonly socket: WebSocket;
    readonly class: typeof TlsOverWs;
    readonly connection: node_forge.tls.Connection;
    constructor(socket: WebSocket);
}

export { TlsOverWs };
