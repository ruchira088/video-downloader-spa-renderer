import express, {Request, Response} from "express"
import puppeteer from "puppeteer"

interface RenderRequest {
    readonly url: string
    readonly readyCssSelectors: string[] | undefined
}

export const create = async () => {
    const renderRouter = express.Router()
    const browser = await puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"]})

    return renderRouter.post("/", async (request: Request, response: Response) => {
        const renderRequest = request.body as RenderRequest
        const page = await browser.newPage()

        try {
            const result = await page.goto(renderRequest.url, {
                waitUntil:
                    (renderRequest.readyCssSelectors === undefined || renderRequest.readyCssSelectors.length === 0) ? "networkidle0" : undefined
            })

            if (renderRequest.readyCssSelectors !== undefined) {
                await renderRequest.readyCssSelectors
                    .reduce<Promise<void>>((promise, cssSelector) => promise.then(() => page.waitForSelector(cssSelector).then(() => {})), Promise.resolve())
            }

            const content = await page.content()

            response
                .status(result?.status() || 200)
                .send(content)
        } catch (error: unknown) {
            response.status(400)
                .json({errorMessages: [(error as Error).message]})
        } finally {
            await page.close()
        }

    })
}


