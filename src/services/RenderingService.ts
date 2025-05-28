import {create as createLogger} from "../logger/Logger"
import {Logger} from "winston"
import {Clock} from "../utils/Clock"
import puppeteer, {Browser, Page} from "puppeteer"
import {Optional} from "../utils/Helpers"

export interface RenderingService {
    render(url: string, readyCssSelectors: Optional<string[]>): Promise<string>

    execute(url: string, js: string, readyCssSelectors: Optional<string[]>): Promise<string>
}

const logger: Logger = createLogger(__filename)

export const launchBrowser =
    (): Promise<Browser> => puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"], headless: true})

export const createRenderingService = async (browser: Browser, clock: Clock): Promise<RenderingService> => {
    async function run<A>(url: string, readyCssSelectors: Optional<string[]>, execute: (page: Page) => Promise<A>, action: string): Promise<A> {
        const startTime = clock.timestamp()

        logger.info(`Rendering url=${url} with readyCssSelectors=[${readyCssSelectors?.join(", ") || ""}]`)

        const page = await browser.newPage()

        const hasReadyCssSelectors =
            readyCssSelectors !== undefined && readyCssSelectors !== null && readyCssSelectors.length > 0

        try {
            await page.goto(url, {
                waitUntil:
                    hasReadyCssSelectors ? undefined : "load"
            })

            if (hasReadyCssSelectors) {
                await readyCssSelectors
                    .reduce<Promise<void>>(
                        async (promise, cssSelector) => {
                            await promise
                            await page.waitForSelector(cssSelector)
                        },
                        Promise.resolve()
                    )
            }

            const result: A = await execute(page)

            const endTime = clock.timestamp()
            const duration = endTime.getTime() - startTime.getTime()

            logger.info(`Successfully ${action} url=${url} duration=${duration}ms`)

            return result
        } finally {
            await page.close()
        }
    }

    return ({
        render(url: string, readyCssSelectors: Optional<string[]>): Promise<string> {
            return run(url, readyCssSelectors, page => page.content(), "rendered")
        },
        execute(url: string, js: string, readyCssSelectors: Optional<string[]>): Promise<string> {
            return run(url, readyCssSelectors, page => page.evaluate(js) as Promise<string>, "executed JS")
        }
    })
}
