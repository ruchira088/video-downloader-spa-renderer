import {NextFunction, Request, Response} from "express"
import * as Logger from "../logger/Logger"

const logger = Logger.create(__filename)

const errorHandler = (error: Error, request: Request, response: Response, next: NextFunction) => {
    logger.error(error.stack)

    response.status(500).json({ errorMessage: [ error.message ]})
}

export default errorHandler