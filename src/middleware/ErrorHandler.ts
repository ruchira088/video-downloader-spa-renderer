import { NextFunction, Request, Response } from "express"
import { create as createLogger } from "../logger/Logger"
import { ZodError } from "zod/v4"

const logger = createLogger(__filename)

/**
 * Express middleware attaches an HTTP status to the errors it raises - a
 * malformed JSON body, for example, surfaces as an `entity.parse.failed`
 * error carrying a 400. Honouring it stops client mistakes from being
 * reported as server failures.
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

/* eslint-disable @typescript-eslint/no-unused-vars */
const errorHandler = (
  error: Error,
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const status = clientErrorStatus(error)

  if (error instanceof ZodError) {
    const zodError = error as ZodError
    response.status(400).json({ errorMessages: zodError.issues })
  } else if (status === undefined) {
    logger.error(error.stack)
    response.status(500).json({ errorMessages: [error.message] })
  } else {
    response.status(status).json({ errorMessages: [error.message] })
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export default errorHandler
