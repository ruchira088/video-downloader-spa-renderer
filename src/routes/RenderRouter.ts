import express, { Request, Response, Router } from "express"
import { z } from "zod"
import { RenderingService } from "../services/RenderingService"

const RenderRequest = z.object({
  url: z.string(),
  readyCssSelectors: z.array(z.string()).nullish(),
})

const JsExecutionRequest = RenderRequest.extend({ script: z.string() })

/**
 * Express 5 forwards the rejection of an async handler to the error
 * middleware, which answers a `RenderingError` with the 400 it carries and
 * any other failure - one of the renderer itself - with a 500.
 */
export const createRenderRouter = (
  renderingService: RenderingService
): Router =>
  express
    .Router()
    .post("/", async (request: Request, response: Response) => {
      const { url, readyCssSelectors } = RenderRequest.parse(request.body)

      response.send(await renderingService.render(url, readyCssSelectors))
    })
    .post("/execute", async (request: Request, response: Response) => {
      const { url, script, readyCssSelectors } = JsExecutionRequest.parse(
        request.body
      )

      response.send(
        await renderingService.execute(url, script, readyCssSelectors)
      )
    })
