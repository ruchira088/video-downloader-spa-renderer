import express, {Request, Response} from "express"
import * as Logger from "../logger/Logger"
import puppeteer from "puppeteer"
import {Clock} from "../utils/Clock"

interface RenderRequest {
    readonly url: string
    readonly readyCssSelectors: string[] | undefined
}

const logger = Logger.create(__filename)

export const create = async (clock: Clock) => {
    const renderRouter = express.Router()
    const browser = await puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"]})

    return renderRouter.post("/", async (request: Request, response: Response) => {
        const renderRequest = request.body as RenderRequest

        const startTime = clock.timestamp()

        logger.info(`Rendering url=${renderRequest.url} with readyCssSelectors=[${renderRequest.readyCssSelectors?.join(", ")}]`)

        const page = await browser.newPage()

        try {
            const result = await page.goto(renderRequest.url, {
                waitUntil:
                    (renderRequest.readyCssSelectors === undefined || renderRequest.readyCssSelectors.length === 0) ? "load" : undefined
            })

            if (renderRequest.readyCssSelectors !== undefined) {
                await renderRequest.readyCssSelectors
                    .reduce<Promise<void>>((promise, cssSelector) => promise.then(() => page.waitForSelector(cssSelector).then(() => {})), Promise.resolve())
            }

            const content = await page.content()

            const endTime = clock.timestamp()
            const duration = endTime.valueOf() - startTime.valueOf()

            logger.info(`Successfully rendered url=${renderRequest.url} duration=${duration}ms`)

            response
                .status(result?.status() || 200)
                .send(content)
        } catch (error: unknown) {
            logger.error(`Failed to render url=${renderRequest.url}`)

            response.status(400)
                .json({errorMessages: [(error as Error).message]})
        } finally {
            await page.close()
        }

    })
}


