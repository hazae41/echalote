export class Binary {
  readonly class = Binary

  offset = 0

  constructor(
    public buffer: Buffer
  ) { }

  static alloc(length: number) {
    return new Binary(Buffer.alloc(length))
  }

  static allocUnsafe(length: number) {
    return new Binary(Buffer.allocUnsafe(length))
  }

  get remaining() {
    return this.buffer.length - this.offset
  }

  get sliced() {
    return this.buffer.subarray(0, this.offset)
  }

  read(length: number, shallow = false) {
    if (this.offset + length > this.buffer.length)
      throw new Error(`Out of bound read`)
    const b = this.buffer.subarray(this.offset, this.offset + length)
    if (!shallow) this.offset += length
    return b
  }

  write(array: Buffer, shallow = false) {
    if (this.offset + length > this.buffer.length)
      throw new Error(`Out of bound write`)
    this.buffer.set(array, this.offset)
    if (!shallow) this.offset += array.length
  }

  fill(end?: number) {
    this.buffer.fill(0, this.offset, end)
  }

  readUint8(shallow = false) {
    const x = this.buffer.readUInt8(this.offset)
    if (!shallow) this.offset++
    return x
  }

  writeUint8(x: number, shallow = false) {
    this.buffer.writeUInt8(x, this.offset)
    if (!shallow) this.offset++
  }

  readUint16(shallow = false) {
    const x = this.buffer.readUInt16BE(this.offset)
    if (!shallow) this.offset += 2
    return x
  }

  writeUint16(x: number, shallow = false) {
    this.buffer.writeUInt16BE(x, this.offset)
    if (!shallow) this.offset += 2
  }

  readUint32(shallow = false) {
    const x = this.buffer.readUInt32BE(this.offset)
    if (!shallow) this.offset += 4
    return x
  }

  writeUint32(x: number, shallow = false) {
    this.buffer.writeUInt32BE(x, this.offset)
    if (!shallow) this.offset += 4
  }

  readString(length: number) {
    return this.read(length).toString()
  }

  writeString(text: string) {
    this.write(Buffer.from(text))
  }

  readNull() {
    let i = this.offset

    while (i < this.buffer.length && this.buffer[i] > 0)
      i++
    if (i === this.buffer.length)
      throw new Error(`Out of bounds NULL-terminated`)
    return this.read(i)
  }

  writeNull(array: Buffer) {
    this.write(array)
    this.writeUint8(0)
  }

  readNullString() {
    return this.readNull().toString()
  }

  writeNullString(text: string) {
    this.writeNull(Buffer.from(text))
  }

  reread(offset: number) {
    const head = this.offset
    this.offset = offset
    return this.read(head - offset)
  }

  split(length: number) {
    const chunks = new Array<Buffer>()

    while (this.remaining)
      chunks.push(this.read(Math.min(this.remaining, length)))
    return chunks
  }
}