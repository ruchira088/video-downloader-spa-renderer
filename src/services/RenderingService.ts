import * as Logger from "../logger/Logger"
import {Clock} from "../utils/Clock"
import puppeteer from "puppeteer"

export interface RenderingService {
    render(url: string, readyCssSelectors: string[] | undefined): Promise<string>
}

const logger = Logger.create(__filename)

export const create = async (clock: Clock): Promise<RenderingService> => {
    const browser = await puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"]})

    return {
        async render(url: string, readyCssSelectors: string[] | undefined): Promise<string> {
            const startTime = clock.timestamp()

            logger.info(`Rendering url=${url} with readyCssSelectors=[${readyCssSelectors?.join(", ")}]`)

            const page = await browser.newPage()

            try {
                await page.goto(url, {
                    waitUntil:
                        (readyCssSelectors === undefined || readyCssSelectors.length === 0) ? "load" : undefined
                })

                if (readyCssSelectors !== undefined) {
                    await readyCssSelectors
                        .reduce<Promise<void>>((promise, cssSelector) => promise.then(() => page.waitForSelector(cssSelector).then(() => {
                        })), Promise.resolve())
                }

                const content: string = await page.content()

                const endTime = clock.timestamp()
                const duration = endTime.valueOf() - startTime.valueOf()

                logger.info(`Successfully rendered url=${url} duration=${duration}ms`)

                return content
            } finally {
                await page.close()
            }
        }
    }
}