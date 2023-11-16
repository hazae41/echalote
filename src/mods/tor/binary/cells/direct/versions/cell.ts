import { Cursor } from "@hazae41/cursor"

export class VersionsCell {
  readonly #class = VersionsCell

  static readonly old = true
  static readonly circuit = false
  static readonly command = 7

  constructor(
    readonly versions: number[]
  ) { }

  get old(): true {
    return this.#class.old
  }

  get circuit(): false {
    return this.#class.circuit
  }

  get command(): 7 {
    return this.#class.command
  }

  sizeOrThrow() {
    return 2 * this.versions.length
  }

  writeOrThrow(cursor: Cursor) {
    for (const version of this.versions)
      cursor.writeUint16OrThrow(version)

    return
  }

  static readOrThrow(cursor: Cursor) {
    const versions = new Array<number>(cursor.remaining / 2)

    for (let i = 0; i < versions.length; i++)
      versions[i] = cursor.readUint16OrThrow()

    return new VersionsCell(versions)
  }

}