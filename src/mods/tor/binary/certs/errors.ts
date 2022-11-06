export class Duplicated extends Error {
  constructor(
    readonly type: number
  ) {
    super(`Found duplicate certificate type ${type}`)
  }
}