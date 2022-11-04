import { Tls } from '../tls/tls.js';
import { Certs } from './binary/cells/direct/certs.js';
import { Circuit } from './circuit.js';
import { Directories } from './consensus/directories.js';

declare type TorState = TorNoneState | TorVersionedState | TorHandshakingState | TorHandshakedState;
interface TorNoneState {
    readonly type: "none";
}
interface TorVersionedState {
    readonly type: "versioned";
    readonly version: number;
}
interface TorHandshakingState {
    readonly type: "handshaking";
    readonly version: number;
    readonly guard: Guard;
}
interface TorHandshakedState {
    readonly type: "handshaked";
    readonly version: number;
    readonly guard: Guard;
}
interface Guard {
    readonly idh: Buffer;
    readonly certs: Certs;
}
interface Fallback {
    id: string;
    eid: string;
    exit: boolean;
    onion: number[];
    hosts: string[];
}
declare class Tor extends EventTarget {
    readonly tls: Tls;
    readonly class: typeof Tor;
    private _state;
    readonly directories: Directories;
    readonly circuits: Map<number, Circuit>;
    readonly streams: TransformStream<Buffer, Buffer>;
    private buffer;
    private wbuffer;
    private rbuffer;
    fallbacks: {
        exits: Fallback[];
        middles: Fallback[];
    };
    constructor(tls: Tls);
    get state(): TorState;
    init(): Promise<void>;
    send(...arrays: Buffer[]): void;
    private onMessage;
    private tryRead;
    private read;
    private onRead;
    private onCell;
    private onNoneStateCell;
    private onVersionedStateCell;
    private onHandshakingStateCell;
    private onHandshakedStateCell;
    private onVersionsCell;
    private onCertsCell;
    private onAuthChallengeCell;
    private onNetinfoCell;
    private onCreatedFastCell;
    private onDestroyCell;
    private onRelayCell;
    private onRelayExtended2Cell;
    private onRelayConnectedCell;
    private onRelayDataCell;
    private onRelayEndCell;
    private onRelayDropCell;
    private onRelayTruncatedCell;
    private waitHandshake;
    handshake(): Promise<void>;
    private waitCreatedFast;
    create(): Promise<Circuit>;
}

export { Fallback, Guard, Tor, TorHandshakedState, TorHandshakingState, TorNoneState, TorState, TorVersionedState };
