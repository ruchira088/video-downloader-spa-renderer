import { Logger } from "winston"
import { create as createLogger } from "../logger/Logger"
import { errorMessage } from "./Helpers"

const logger: Logger = createLogger(__filename)

export interface Closeable {
  close(callback: (error?: Error) => void): void
}

/**
 * Returns a signal handler that stops the server accepting connections and
 * lets in-flight requests finish, then either lets the process end naturally
 * or, if the server is still open once `gracePeriodMs` has elapsed, exits
 * with a failure so that a hung render cannot outlive the orchestrator's
 * patience. Repeated signals are ignored.
 */
export const gracefulShutdown = (
  server: Closeable,
  gracePeriodMs: number,
  exit: (code: number) => void
): (() => void) => {
  let shuttingDown = false

  return () => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    logger.info("Shutting down server...")

    const forceExit = setTimeout(() => {
      logger.error(`Server did not close within ${gracePeriodMs}ms, exiting`)
      exit(1)
    }, gracePeriodMs)

    // The timer must not be what keeps the process alive once the server
    // has closed.
    forceExit.unref()

    server.close((error) => {
      clearTimeout(forceExit)

      if (error === undefined) {
        logger.info("Server stopped")
      } else {
        logger.error(`Failed to stop server: ${errorMessage(error)}`)
        exit(1)
      }
    })
  }
}
