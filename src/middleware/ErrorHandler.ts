import {NextFunction, Request, Response} from "express"
import {create as createLogger} from "../logger/Logger"
import {ZodError} from "zod"

const logger = createLogger(__filename)

const errorHandler = (error: Error, request: Request, response: Response, next: NextFunction) => {

    if (error instanceof ZodError) {
        const zodError = error as ZodError
        response.status(400).json({errorMessage: zodError.errors})
    } else {
        logger.error(error.stack)
        response.status(500).json({errorMessage: [error.message]})
    }
}

export default errorHandler