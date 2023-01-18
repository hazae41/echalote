export interface CloseEvent extends Event {
  readonly code?: number;
  readonly reason?: string;
  readonly wasClean?: boolean;
}

export class CloseEvent extends Event {
  constructor(type: string, eventInitDict: CloseEventInit) {
    super(type, eventInitDict)
  }
}