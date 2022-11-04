import { Binary } from "libs/binary.js"

export interface Cert {
  readonly type: number

  write(binary: Binary): void
}