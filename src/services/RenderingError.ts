/**
 * A failure that is attributable to the render request itself - an unusable
 * URL, a page that cannot be reached, a selector that never appears or a
 * script that throws. It carries the 400 status that the error handler
 * honours, so routes can simply let it propagate. Failures of the renderer
 * itself (launching Chromium, opening a page) are deliberately not wrapped, so
 * that they surface as server errors rather than as bad requests.
 */
export class RenderingError extends Error {
  readonly status = 400

  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = "RenderingError"
  }
}
