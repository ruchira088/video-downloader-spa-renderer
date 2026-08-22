/**
 * A failure that is attributable to the render request itself - an unusable
 * URL, a page that cannot be reached, a selector that never appears or a
 * script that throws. Failures of the renderer itself (launching Chromium,
 * opening a page) are deliberately not wrapped, so that they surface as
 * server errors rather than as bad requests.
 */
export class RenderingError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = "RenderingError"
  }
}
