export class Slot<T extends Disposable> implements Disposable {

  constructor(
    public inner: T
  ) { }

  [Symbol.dispose]() {
    this.inner[Symbol.dispose]()
  }

  disposeAndReplace(inner: T) {
    this.inner[Symbol.dispose]()
    this.inner = inner
  }

}