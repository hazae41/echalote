import { Binary } from '../../../libs/binary.js';
import { Future } from '../../../libs/future.js';

declare type HttpState = HttpNoneState | HttpHeadedState;
interface HttpNoneState {
    type: "none";
    buffer: Binary;
}
interface HttpHeadedState {
    type: "headed";
    length: number;
    version: string;
    encoding: HttpEncoding;
}
declare type HttpEncoding = HttpChunkedEncoding | HttpLengthedEncoding;
interface HttpChunkedEncoding {
    type: "chunked";
    buffer: Binary;
}
interface HttpLengthedEncoding {
    type: "lengthed";
    length: number;
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

export { HttpChunkedEncoding, HttpEncoding, HttpHeadedState, HttpLengthedEncoding, HttpNoneState, HttpState, HttpStream };
