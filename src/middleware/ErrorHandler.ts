import { NextFunction, Request, Response } from "express"
import { ZodError } from "zod"
import { create as createLogger } from "../logger/Logger"

const logger = createLogger(__filename)

/**
 * Errors that describe a client mistake carry a 4xx status: Express attaches
 * one to the errors its middleware raises (a malformed JSON body surfaces as
 * an `entity.parse.failed` error with a 400) and `RenderingError` carries one
 * too. Honouring it stops client mistakes from being reported as server
 * failures.
 */
const clientErrorStatus = (error: Error): number | undefined => {
  const { status, statusCode } = error as {
    status?: unknown
    statusCode?: unknown
  }
  const candidate = typeof status === "number" ? status : statusCode

  return typeof candidate === "number" && candidate >= 400 && candidate <= 499
    ? candidate
    : undefined
}

// Express recognises error handlers by their arity, so the unused `next`
// parameter has to stay.
const errorHandler = (
  error: Error,
  request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    response.status(400).json({ errorMessages: error.issues })
    return
  }

  const status = clientErrorStatus(error)

  if (status === undefined) {
    logger.error(error.stack)
  }

  response.status(status ?? 500).json({ errorMessages: [error.message] })
}

export default errorHandler
