import {NextFunction, Request, Response} from "express"
import {create as createLogger} from "../logger/Logger"
import {ZodError} from "zod/v4"

const logger = createLogger(__filename)

/* eslint-disable @typescript-eslint/no-unused-vars */
const errorHandler =
    (error: Error, request: Request, response: Response, next: NextFunction)  => {

    if (error instanceof ZodError) {
        const zodError = error as ZodError
        response.status(400).json({errorMessage: zodError.issues})
    } else {
        logger.error(error.stack)
        response.status(500).json({errorMessage: [error.message]})
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export default errorHandler
