import { Circuit } from '../circuit.js';

interface AbortEvent extends Event {
    type: "abort";
    target: AbortSignal;
    currentTarget: AbortSignal;
}
declare class TcpStream extends EventTarget {
    readonly circuit: Circuit;
    readonly id: number;
    readonly signal?: AbortSignal | undefined;
    /**
     * Output stream bufferer
     */
    readonly rstreams: TransformStream<Buffer, Buffer>;
    /**
     * Input stream bufferer
     */
    readonly wstreams: TransformStream<Buffer, Buffer>;
    /**
     * Output stream
     */
    readonly readable: ReadableStream<Buffer>;
    /**
     * Input stream
     */
    readonly writable: WritableStream<Buffer>;
    private closed;
    constructor(circuit: Circuit, id: number, signal?: AbortSignal | undefined);
    private onAbort;
    private onRelayDataCell;
    private onRelayEndCell;
    private onRelayTruncatedCell;
    private tryWrite;
    private write;
    private onWrite;
}

export { AbortEvent, TcpStream };
