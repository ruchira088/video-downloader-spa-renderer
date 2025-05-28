import express, {Request, Response, Router} from "express"
import {RenderingService} from "../services/RenderingService"
import {z} from "zod"

const RenderRequest = z.object({
    url: z.string(),
    readyCssSelectors: z.string().array().nullish()
})

type RenderRequest = z.infer<typeof RenderRequest>

const JsExecutionRequest =
    RenderRequest.and(z.object({script: z.string()}))

type JsExecutionRequest = z.infer<typeof JsExecutionRequest>

export const createRenderRouter = (renderingService: RenderingService): Router => {
    const createResponse = (response: Response, result: Promise<unknown>): Promise<Response> =>
        result
            .then(data => response.status(200).send(data))
            .catch(exception =>
                response.status(400).json({errorMessages: [(exception as Error).message]})
            )

    return express.Router()
        .post("/", (request: Request, response: Response) => {
            const {url, readyCssSelectors}: RenderRequest = RenderRequest.parse(request.body)

            createResponse(response, renderingService.render(url, readyCssSelectors))
        })
        .post("/execute", async (request: Request, response: Response) => {
            const {url, script, readyCssSelectors}: JsExecutionRequest = JsExecutionRequest.parse(request.body)

            createResponse(
                response,
                renderingService.execute(url, script, readyCssSelectors)
            )
        })
}