import express, { NextFunction, Request, Response, Router } from "express"
import { RenderingError, RenderingService } from "../services/RenderingService"
import { z } from "zod/v4"

const RenderRequest = z.object({
  url: z.string(),
  readyCssSelectors: z.array(z.string()).nullish(),
})

type RenderRequest = z.infer<typeof RenderRequest>

const JsExecutionRequest = RenderRequest.and(z.object({ script: z.string() }))

type JsExecutionRequest = z.infer<typeof JsExecutionRequest>

/**
 * Failures caused by the request are reported as a 400. Anything else is a
 * failure of the renderer itself, so it is forwarded to the error handler and
 * reported as a 500.
 */
const createResponse = (
  response: Response,
  next: NextFunction,
  result: Promise<unknown>
): Promise<void> =>
  result
    .then((data) => {
      response.status(200).send(data)
    })
    .catch((exception: unknown) => {
      if (exception instanceof RenderingError) {
        response.status(400).json({ errorMessages: [exception.message] })
      } else {
        next(exception)
      }
    })

export const createRenderRouter = (
  renderingService: RenderingService
): Router => {
  return express
    .Router()
    .post("/", (request: Request, response: Response, next: NextFunction) => {
      const { url, readyCssSelectors }: RenderRequest = RenderRequest.parse(
        request.body
      )

      createResponse(
        response,
        next,
        renderingService.render(url, readyCssSelectors)
      )
    })
    .post(
      "/execute",
      (request: Request, response: Response, next: NextFunction) => {
        const { url, script, readyCssSelectors }: JsExecutionRequest =
          JsExecutionRequest.parse(request.body)

        createResponse(
          response,
          next,
          renderingService.execute(url, script, readyCssSelectors)
        )
      }
    )
}
