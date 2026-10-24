/**
 * Raised when every render slot is busy and the queue is full. It carries the
 * 503 status and the `Retry-After` hint that the error handler answers with.
 */
export class RendererBusyError extends Error {
  readonly status = 503
  readonly retryAfterSeconds = 5

  constructor() {
    super("The renderer is at capacity, try again shortly")
    this.name = "RendererBusyError"
  }
}
