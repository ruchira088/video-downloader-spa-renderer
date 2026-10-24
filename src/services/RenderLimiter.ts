import { RendererBusyError } from "./RendererBusyError"

type Waiter = {
  start: () => void
  onAbort: () => void
}

/**
 * Bounds how many renders run at once, since each one is a Chromium process
 * that costs hundreds of megabytes. Tasks beyond `maxConcurrent` wait in a
 * first-in, first-out queue of at most `maxQueued`; anything beyond that is
 * rejected straight away so that a burst of requests is shed rather than
 * left to exhaust the container's memory.
 */
export class RenderLimiter {
  private running = 0
  private readonly queue: Waiter[] = []

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number
  ) {}

  async run<A>(task: () => Promise<A>, signal: AbortSignal): Promise<A> {
    await this.acquire(signal)

    try {
      return await task()
    } finally {
      this.release()
    }
  }

  private acquire(signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
      return Promise.reject(signal.reason)
    }

    if (this.running < this.maxConcurrent) {
      this.running++
      return Promise.resolve()
    }

    if (this.queue.length >= this.maxQueued) {
      return Promise.reject(new RendererBusyError())
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        // The slot passes straight from the releasing task to this one, so
        // `running` is left as it is.
        start: () => {
          signal.removeEventListener("abort", waiter.onAbort)
          resolve()
        },
        onAbort: () => {
          this.queue.splice(this.queue.indexOf(waiter), 1)
          reject(signal.reason)
        },
      }

      signal.addEventListener("abort", waiter.onAbort, { once: true })
      this.queue.push(waiter)
    })
  }

  private release(): void {
    const next = this.queue.shift()

    if (next === undefined) {
      this.running--
    } else {
      next.start()
    }
  }
}
