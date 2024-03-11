import { Guard } from "./client.js"

export type TorState =
  | TorNoneState
  | TorVersionedState
  | TorHandshakingState
  | TorHandshakedState

export interface TorNoneState {
  readonly type: "none"
}

export interface TorVersionedState {
  readonly type: "versioned",
  readonly version: number
}

export interface TorHandshakingState {
  readonly type: "handshaking",
  readonly version: number
  readonly guard: Guard
}

export interface TorHandshakedState {
  readonly type: "handshaked",
  readonly version: number
  readonly guard: Guard
}