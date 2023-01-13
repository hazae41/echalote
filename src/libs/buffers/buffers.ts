export namespace Buffers {

  export function fromView(view: ArrayBufferView) {
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength)
  }
}