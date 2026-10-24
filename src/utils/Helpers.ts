export type Optional<T> = T | undefined | null

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Settles with the outcome of `promise`, or rejects with the abort reason as
 * soon as `signal` aborts. The abandoned promise keeps running, so whoever
 * aborts is responsible for stopping the work behind it; its eventual
 * rejection is swallowed rather than surfacing as an unhandled rejection.
 */
export const abortable = <A>(
  promise: Promise<A>,
  signal: AbortSignal
): Promise<A> => {
  promise.catch(() => {
    /* reported through the returned promise, or abandoned after an abort */
  })

  if (signal.aborted) {
    return Promise.reject(signal.reason)
  }

  return new Promise<A>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)

    signal.addEventListener("abort", onAbort, { once: true })

    promise
      .finally(() => {
        signal.removeEventListener("abort", onAbort)
      })
      .then(resolve, reject)
  })
}

/**
 * Runs `work`, rejecting once `timeoutMs` has elapsed without it settling.
 * The signal handed to `work` aborts at the same moment, so the work can stop
 * rather than carry on unobserved. The timer is cleared as soon as the work
 * settles so that it does not keep the process alive.
 */
export const withTimeout = <A>(
  work: (signal: AbortSignal) => Promise<A>,
  timeoutMs: number
): Promise<A> => {
  const controller = new AbortController()

  const timer = setTimeout(() => {
    controller.abort(new Error(`Timed out after ${timeoutMs}ms`))
  }, timeoutMs)

  return abortable(work(controller.signal), controller.signal).finally(() => {
    clearTimeout(timer)
  })
}
