import {Request, Response} from "express"

const notFoundHandler = (request: Request, response: Response) => {
    response.status(404).json({
        errorMessage: [ `Endpoint not found at ${request.originalUrl}` ]
    })
}

export default notFoundHandler