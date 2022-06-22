import express, {Request, Response} from "express"
import puppeteer from "puppeteer"

interface RenderRequest {
    readonly url: string
    readonly readySelector: string | undefined
}

export const create = async () => {
    const renderRouter = express.Router()
    const browser = await puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"]})

    return renderRouter.post("/", async (request: Request, response: Response) => {
        const renderRequest = request.body as RenderRequest
        const page = await browser.newPage()

        try {
            const result = await page.goto(renderRequest.url, {
                waitUntil: renderRequest.readySelector === undefined ? "domcontentloaded" : undefined
            })

            if (renderRequest.readySelector !== undefined) {
                await page.waitForSelector(renderRequest.readySelector)
            }

            const content = await page.content()

            response
                .status(result?.status() || 200)
                .send(content)
        } finally {
            await page.close()
        }

    })
}


