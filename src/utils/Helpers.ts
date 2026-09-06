export type Optional<T> = T | undefined | null

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Settles with the outcome of `promise`, or rejects once `timeoutMs` has
 * elapsed without it settling. The timer is cleared as soon as the promise
 * settles so that it does not keep the process alive.
 */
export const withTimeout = <A>(
  promise: Promise<A>,
  timeoutMs: number
): Promise<A> =>
  new Promise<A>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .finally(() => {
        clearTimeout(timer)
      })
      .then(resolve, reject)
  })
