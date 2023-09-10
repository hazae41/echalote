import { Opaque, Writable } from "@hazae41/binary"
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
  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  constructor(
    readonly request: RequestInfo,
    readonly params: BatchedFetchStreamParams = {}
  ) {
    const { lowDelay = 100, highDelay = 1000 } = params

    let rcontroller: ReadableStreamDefaultController<Opaque>
    let wcontroller: WritableStreamDefaultController

    let batch = new Array<Uint8Array>()

    let timeout: NodeJS.Timeout
    let interval: NodeJS.Timeout

    this.readable = new ReadableStream<Opaque>({
      async start(controller) {
        rcontroller = controller
      },
      async cancel(e) {
        wcontroller.error(e)
      }
    })

    this.writable = new WritableStream<Writable>({
      async start(controller) {
        wcontroller = controller
      },
      async write(chunk) {
        clearTimeout(timeout)
        clearInterval(interval)

        batch.push(Writable.tryWriteToBytes(chunk).unwrap())

        timeout = setTimeout(async () => {

          interval = setInterval(async () => {
            try {
              const res = await fetch(request, { method: "POST" })
              const data = new Uint8Array(await res.arrayBuffer())
              rcontroller.enqueue(new Opaque(data))
            } catch (e: unknown) {
              clearInterval(interval)
              rcontroller.error(e)
              wcontroller.error(e)
            }
          }, highDelay)

          try {
            const body = Bytes.concat(batch)

            batch = new Array<Uint8Array>()

            const res = await fetch(request, { method: "POST", body })
            const data = new Uint8Array(await res.arrayBuffer())
            rcontroller.enqueue(new Opaque(data))
          } catch (e: unknown) {
            clearInterval(interval)
            rcontroller.error(e)
            wcontroller.error(e)
          }
        }, lowDelay)
      },
      async abort(e) {
        rcontroller.error(e)
      }
    })
  }
}