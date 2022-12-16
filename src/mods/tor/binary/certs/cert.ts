import { Binary } from "@hazae41/binary"

export interface Cert {
  readonly type: number

  write(binary: Binary): void
}