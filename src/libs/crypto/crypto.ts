import { Err, Ok, Result } from "@hazae41/result";
import { Promiseable } from "libs/promises/promiseable.js";

export class CryptoError extends Error {
  readonly #class = CryptoError
  readonly name = this.#class.name

  static from(cause: unknown) {
    return new CryptoError(undefined, { cause })
  }
}

export async function tryCrypto<T>(callback: () => Promiseable<T>): Promise<Result<T, CryptoError>> {
  try {
    return new Ok(await callback())
  } catch (e: unknown) {
    return new Err(CryptoError.from(e))
  }
}

export function tryCryptoSync<T>(callback: () => T): Result<T, CryptoError> {
  try {
    return new Ok(callback())
  } catch (e: unknown) {
    return new Err(CryptoError.from(e))
  }
}