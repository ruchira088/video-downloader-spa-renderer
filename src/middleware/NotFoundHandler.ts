import {NextFunction, Request, Response} from "express"

const notFoundHandler = (request: Request, response: Response, next: NextFunction) => {
    response.status(404).json({
        errorMessage: [ `Endpoint not found at ${request.originalUrl}` ]
    })
}

export default notFoundHandler