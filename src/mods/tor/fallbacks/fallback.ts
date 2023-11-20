export interface OldFallback {
  /**
   * 20-bytes RSA identity fingerprint
   */
  readonly id: string,

  /**
   * Ed25519 public key
   */
  readonly eid?: string,

  /**
   * Is this an exit node?
   */
  readonly exit?: boolean,

  /**
   * Onion key
   */
  readonly onion: number[]


  readonly hosts: string[]
}
