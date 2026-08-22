import { create as createLogger } from "../logger/Logger"
import { Logger } from "winston"
import { Clock } from "../utils/Clock"
import puppeteer, { Browser, Page, WaitForSelectorOptions } from "puppeteer"
import { Optional } from "../utils/Helpers"
import { RenderingError } from "./RenderingError"

export { RenderingError }

export interface RenderingService {
  render(url: string, readyCssSelectors: Optional<string[]>): Promise<string>

  execute(
    url: string,
    js: string,
    readyCssSelectors: Optional<string[]>
  ): Promise<string>
}

export const launchBrowser = (): Promise<Browser> =>
  puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    headless: true,
  })

const DEFAULT_SELECTOR_TIMEOUT_MS = 30_000

const ALLOWED_PROTOCOLS = ["http:", "https:"]

const validateUrl = (url: string): void => {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch (exception) {
    throw new RenderingError(`Invalid URL: ${url}`, exception)
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new RenderingError(
      `Invalid URL protocol: ${parsed.protocol}. Only http and https are allowed.`
    )
  }
}

const renderPage = async <A>(
  page: Page,
  url: string,
  readyCssSelectors: Optional<string[]>,
  execute: (page: Page) => Promise<A>,
  selectorTimeoutMs: number
): Promise<A> => {
  const hasReadyCssSelectors =
    readyCssSelectors !== undefined &&
    readyCssSelectors !== null &&
    readyCssSelectors.length > 0

  try {
    await page.goto(url, {
      waitUntil: hasReadyCssSelectors ? undefined : "load",
    })

    if (hasReadyCssSelectors) {
      const waitOptions: WaitForSelectorOptions = {
        timeout: selectorTimeoutMs,
      }
      await readyCssSelectors.reduce<Promise<void>>(
        async (promise, cssSelector) => {
          await promise
          await page.waitForSelector(cssSelector, waitOptions)
        },
        Promise.resolve()
      )
    }

    return await execute(page)
  } catch (exception) {
    throw exception instanceof RenderingError
      ? exception
      : new RenderingError((exception as Error).message, exception)
  }
}

const logger: Logger = createLogger(__filename)

export class PuppeteerRenderingService implements RenderingService {
  constructor(private readonly clock: Clock) {}

  async run<A>(
    url: string,
    readyCssSelectors: Optional<string[]>,
    execute: (page: Page) => Promise<A>,
    action: string,
    selectorTimeoutMs: number = DEFAULT_SELECTOR_TIMEOUT_MS
  ): Promise<A> {
    const startTime = this.clock.timestamp()

    validateUrl(url)

    logger.info(
      `Rendering url=${url} with readyCssSelectors=[${readyCssSelectors?.join(", ") || ""}]`
    )
    const browser = await launchBrowser()

    try {
      const page = await browser.newPage()

      const result: A = await renderPage(
        page,
        url,
        readyCssSelectors,
        execute,
        selectorTimeoutMs
      )

      const endTime = this.clock.timestamp()
      const duration = endTime.getTime() - startTime.getTime()

      logger.info(`Successfully ${action} url=${url} duration=${duration}ms`)

      return result
    } catch (exception) {
      logger.error(`Failed to ${action} url=${url}`, exception)
      throw exception
    } finally {
      await browser.close()
    }
  }

  render(url: string, readyCssSelectors: Optional<string[]>): Promise<string> {
    return this.run(
      url,
      readyCssSelectors,
      (page) => page.content(),
      "rendered"
    )
  }

  execute(
    url: string,
    js: string,
    readyCssSelectors: Optional<string[]>
  ): Promise<string> {
    return this.run(
      url,
      readyCssSelectors,
      (page) => page.evaluate(js) as Promise<string>,
      "executed JS"
    )
  }
}
