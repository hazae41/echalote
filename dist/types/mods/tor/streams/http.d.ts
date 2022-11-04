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
    readonly url: URL;
    readonly res: Future<Response, unknown>;
    /**
     * HTTP output bufferer
     */
    readonly rstreams: TransformStream<Buffer, Buffer>;
    /**
     * HTTP input bufferer
     */
    readonly wstreams: TransformStream<Buffer, Buffer>;
    state: HttpState;
    constructor(sstreams: ReadableWritablePair<Buffer, Buffer>, req?: Request, url?: URL);
    private tryWrite;
    private write;
    private onWriteStart;
    private onWrite;
    private onWriteEnd;
    private tryRead;
    private read;
    private onRead;
}

export { HttpChunkedTransfer, HttpCompression, HttpGzipCompression, HttpHeadedState, HttpLengthedTransfer, HttpNoneCompression, HttpNoneState, HttpState, HttpStream, HttpTransfer };
