import { Bytes } from "@hazae41/bytes"

export interface BatchedFetchStreamParams {
  /**
   * Minimum delay of interaction
   * 
   * Delay between a write and a fetch (in order to wait for more packets and batch them)
   */
  lowDelay?: number

  /**
   * Maximum delay of interaction
   * 
   * Delay between each fetch when the batch is empty
   */
  highDelay?: number
}

export class BatchedFetchStream {
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly request: RequestInfo,
    readonly params: BatchedFetchStreamParams = {}
  ) {
    const { lowDelay = 100, highDelay = 1000 } = params

    let rcontroller: ReadableStreamController<Uint8Array>
    let wcontroller: WritableStreamDefaultController

    let batch = new Array<Uint8Array>()

    let timeout: NodeJS.Timeout
    let interval: NodeJS.Timer

    this.readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        rcontroller = controller
      },
      async cancel(e) {
        wcontroller.error(e)
      }
    })

    this.writable = new WritableStream<Uint8Array>({
      async start(controller) {
        wcontroller = controller
      },
      async write(chunk) {
        clearTimeout(timeout)
        clearInterval(interval)

        batch.push(chunk)

        timeout = setTimeout(async () => {

          interval = setInterval(async () => {
            const res = await fetch(request, { method: "POST" })
            const data = new Uint8Array(await res.arrayBuffer())
            rcontroller.enqueue(data)
          }, highDelay)

          const body = Bytes.concat(batch)

          batch = new Array<Uint8Array>()

          const res = await fetch(request, { method: "POST", body })
          const data = new Uint8Array(await res.arrayBuffer())
          rcontroller.enqueue(data)
        }, lowDelay)
      },
      async abort(e) {
        rcontroller.error(e)
      }
    })
  }
}