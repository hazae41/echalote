import { GzDecoder } from '@hazae41/foras';
import { Binary } from '../../../libs/binary.js';
import { Future } from '../../../libs/future.js';

declare type HttpState = HttpNoneState | HttpHeadedState;
interface HttpNoneState {
    type: "none";
    buffer: Binary;
}
interface HttpHeadedState {
    type: "headed";
    version: string;
    transfer: HttpTransfer;
    compression: HttpCompression;
}
declare type HttpTransfer = HttpChunkedTransfer | HttpLengthedTransfer;
interface HttpChunkedTransfer {
    type: "chunked";
    buffer: Binary;
}
interface HttpLengthedTransfer {
    type: "lengthed";
    offset: number;
    length: number;
}
declare type HttpCompression = HttpNoneCompression | HttpGzipCompression;
interface HttpNoneCompression {
    type: "none";
}
interface HttpGzipCompression {
    type: "gzip";
    decoder: GzDecoder;
}
declare class HttpStream extends EventTarget {
    readonly sstreams: ReadableWritablePair<Buffer, Buffer>;
    readonly req: Request;
    readonly res: Future<Response, unknown>;
    /**
     * HTTP output bufferer
     */
    readonly rstreams: TransformStream<Buffer, Buffer>;
    /**
     * HTTP input bufferer
     */
    readonly wstreams: TransformStream<Uint8Array, Uint8Array>;
    state: HttpState;
    /**
     * HTTP 1.1
     * @implements chunked encoding request/response
     * @implements lengthed encoding response
     * @implements uncompressed request/response
     * @implements gzip compressed response
     */
    constructor(sstreams: ReadableWritablePair<Buffer, Buffer>, req: Request);
    private tryWrite;
    private write;
    private onWriteStart;
    private onWrite;
    private onWriteEnd;
    private tryRead;
    private read;
    private onRead;
    private getTransferFromHeaders;
    private getCompressionFromHeaders;
    private onReadNone;
    private onReadLenghted;
    private onReadChunked;
}

export { HttpChunkedTransfer, HttpCompression, HttpGzipCompression, HttpHeadedState, HttpLengthedTransfer, HttpNoneCompression, HttpNoneState, HttpState, HttpStream, HttpTransfer };
