export interface CloseEvent extends Event {
  readonly code?: number;
  readonly reason?: string;
  readonly wasClean?: boolean;
}

export class CloseEvent extends Event {
  readonly code?: number;
  readonly reason?: string;
  readonly wasClean?: boolean;

  constructor(type: string, eventInitDict: CloseEventInit) {
    super(type, eventInitDict)

    const { code, reason, wasClean } = eventInitDict
    Object.assign(this, { code, reason, wasClean })
  }
}