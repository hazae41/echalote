import { Opaque } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Err, Ok, Result } from "@hazae41/result"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { CrossCert, Ed25519Cert, RsaCert } from "mods/tor/binary/certs/index.js"
import { Certs } from "mods/tor/certs/certs.js"

export class DuplicatedCertError extends Error {
  readonly #class = DuplicatedCertError
  readonly name = this.#class.name

  constructor() {
    super(`Duplicated certificate`)
  }

}

export class UnknownCertError extends Error {
  readonly #class = UnknownCertError
  readonly name = this.#class.name

  constructor() {
    super(`Unknown certificate`)
  }

}

export class CertsCell {
  readonly #class = CertsCell

  static command = 129

  constructor(
    readonly circuit: undefined,
    readonly certs: Partial<Certs>
  ) { }

  get command() {
    return this.#class.command
  }

  static tryRead(cursor: Cursor) {
    return Result.unthrowSync(t => {
      const ncerts = cursor.tryReadUint8().throw(t)
      const certs: Partial<Certs> = {}

      for (let i = 0; i < ncerts; i++) {
        const type = cursor.tryReadUint8().throw(t)
        const length = cursor.tryReadUint16().throw(t)

        if (type === RsaCert.types.RSA_SELF) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_self = RsaCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === RsaCert.types.RSA_TO_AUTH) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_to_auth = RsaCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === RsaCert.types.RSA_TO_TLS) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_to_tls = RsaCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === CrossCert.types.RSA_TO_ED) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_to_ed = CrossCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === Ed25519Cert.types.ED_TO_SIGN) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.ed_to_sign = Ed25519Cert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === Ed25519Cert.types.SIGN_TO_TLS) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.sign_to_tls = Ed25519Cert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === Ed25519Cert.types.SIGN_TO_AUTH) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.sign_to_auth = Ed25519Cert.tryRead(cursor, type, length).throw(t)
          continue
        }

        return new Err(new UnknownCertError())
      }

      return new Ok({ certs })
    })
  }

  static tryUncell(cell: Cell<Opaque>) {
    const { command, circuit } = cell

    if (command !== this.command)
      throw new InvalidCommand(this.name, command)
    if (circuit)
      throw new InvalidCircuit(this.name, circuit)

    return cell.payload.tryInto(this).mapSync(x => new CertsCell(circuit, x.certs))
  }

}