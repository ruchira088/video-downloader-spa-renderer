import * as Logger from "../logger/Logger"
import {Clock} from "../utils/Clock"
import puppeteer, {Browser} from "puppeteer"

export interface RenderingService {
    render(url: string, readyCssSelectors: string[] | undefined): Promise<string>
}

const logger = Logger.create(__filename)

export const launchBrowser =
    (): Promise<Browser> => puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"]})

export const create = async (browser: Browser, clock: Clock): Promise<RenderingService> =>
    ({
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
    })
