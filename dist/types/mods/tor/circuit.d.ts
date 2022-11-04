import { TcpStream } from './streams/tcp.js';
import { Target } from './target.js';
import { Tor } from './tor.js';

declare class Circuit extends EventTarget {
    readonly tor: Tor;
    readonly id: number;
    readonly class: typeof Circuit;
    private _nonce;
    private _closed;
    readonly targets: Target[];
    readonly streams: Map<number, TcpStream>;
    constructor(tor: Tor, id: number);
    get closed(): boolean;
    private onDestroyCell;
    private onRelayExtended2Cell;
    private onRelayTruncatedCell;
    private onRelayConnectedCell;
    private onRelayDataCell;
    private onRelayEndCell;
    private waitExtended;
    extend(exit: boolean): Promise<void>;
    private waitTruncated;
    truncate(reason?: number): Promise<void>;
    open(hostname: string, port: number, signal?: AbortSignal): Promise<TcpStream>;
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

export { Circuit };
