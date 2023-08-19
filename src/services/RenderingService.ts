import * as Logger from "../logger/Logger"
import {Clock} from "../utils/Clock"
import puppeteer, {Browser, Page} from "puppeteer"

export interface RenderingService {
    render(url: string, readyCssSelectors: string[] | undefined): Promise<string>
    execute(url: string, js: string, readyCssSelectors: string[] | undefined): Promise<string>
}

const logger = Logger.create(__filename)

export const launchBrowser =
    (): Promise<Browser> => puppeteer.launch({args: ["--disable-dev-shm-usage", "--no-sandbox"], headless: "new"})

export const create = async (browser: Browser, clock: Clock): Promise<RenderingService> => {
    async function run<A>(url: string, readyCssSelectors: string[] | undefined, execute: (page: Page) => Promise<A>, action: string): Promise<A> {
        const startTime = clock.timestamp()

        logger.info(`Rendering url=${url} with readyCssSelectors=[${readyCssSelectors?.join(", ") || ""}]`)

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

            const result: A = await execute(page)

            const endTime = clock.timestamp()
            const duration = endTime.valueOf() - startTime.valueOf()

            logger.info(`Successfully ${action} url=${url} duration=${duration}ms`)

            return result
        } finally {
            await page.close()
        }
    }
    return ({
        render(url: string, readyCssSelectors: string[] | undefined): Promise<string> {
            return run(url, readyCssSelectors, page => page.content(), "rendered")
        },
        execute(url: string, js: string, readyCssSelectors: string[] | undefined): Promise<string> {
            return run(url, readyCssSelectors, page => page.evaluate(js) as Promise<string>, "executed JS")
        }
    })
}
