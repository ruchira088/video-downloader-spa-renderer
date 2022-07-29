import express, {Request, Response, Router} from "express"
import {RenderingService} from "../services/RenderingService"

interface RenderRequest {
    readonly url: string
    readonly readyCssSelectors: string[] | undefined
}

type JsExecutionRequest = RenderRequest & { script: string }

export const create = (renderingService: RenderingService): Router => {
    const createResponse = (response: Response, result: Promise<unknown>): Promise<Response> =>
        result
            .then(data => response.status(200).send(data))
            .catch(exception =>
                response.status(400).json({errorMessages: [(exception as Error).message]})
            )

    return express.Router()
        .post("/", (request: Request, response: Response) => {
            const {url, readyCssSelectors} = request.body as RenderRequest

            createResponse(response, renderingService.render(url, readyCssSelectors))
        })
        .post("/execute", async (request: Request, response: Response) => {
            const {url, script, readyCssSelectors} = request.body as JsExecutionRequest

            createResponse(
                response,
                renderingService.execute(url, script, readyCssSelectors)
            )
        })
}