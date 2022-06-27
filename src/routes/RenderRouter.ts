import express, {Request, Response} from "express"
import {RenderingService} from "../services/RenderingService"

interface RenderRequest {
    readonly url: string
    readonly readyCssSelectors: string[] | undefined
}

export const create = (renderingService: RenderingService) =>
    express.Router()
        .post("/", async (request: Request, response: Response) => {
            const renderRequest = request.body as RenderRequest

            renderingService.render(renderRequest.url, renderRequest.readyCssSelectors)
                .then(content => response.status(200).send(content))
                .catch(exception =>
                    response.status(400).json({errorMessages: [(exception as Error).message]})
                )
        })