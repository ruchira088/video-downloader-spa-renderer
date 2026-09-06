import puppeteer, { Browser, Page } from "puppeteer"
import { Logger } from "winston"
import { create as createLogger } from "../logger/Logger"
import { Clock } from "../utils/Clock"
import { errorMessage, Optional } from "../utils/Helpers"
import { RenderingError } from "./RenderingError"

export interface RenderingService {
  render(url: string, readyCssSelectors: Optional<string[]>): Promise<string>

  execute(
    url: string,
    js: string,
    readyCssSelectors: Optional<string[]>
  ): Promise<unknown>
}

const DEFAULT_SELECTOR_TIMEOUT_MS = 30_000

const ALLOWED_PROTOCOLS = ["http:", "https:"]

const launchBrowser = (): Promise<Browser> =>
  puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    headless: true,
  })

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

type Action = "render" | "execute"

const logger: Logger = createLogger(__filename)

export class PuppeteerRenderingService implements RenderingService {
  constructor(
    private readonly clock: Clock,
    private readonly selectorTimeoutMs: number = DEFAULT_SELECTOR_TIMEOUT_MS
  ) {}

  render(url: string, readyCssSelectors: Optional<string[]>): Promise<string> {
    return this.run("render", url, readyCssSelectors, (page) => page.content())
  }

  execute(
    url: string,
    js: string,
    readyCssSelectors: Optional<string[]>
  ): Promise<unknown> {
    return this.run("execute", url, readyCssSelectors, (page) =>
      page.evaluate(js)
    )
  }

  /**
   * Launches a fresh browser for the request and closes it once the page has
   * been rendered, whatever the outcome.
   */
  private async run<A>(
    action: Action,
    url: string,
    readyCssSelectors: Optional<string[]>,
    execute: (page: Page) => Promise<A>
  ): Promise<A> {
    const startTime = this.clock.timestamp()

    validateUrl(url)

    const cssSelectors = readyCssSelectors ?? []

    logger.info(
      `Rendering url=${url} with readyCssSelectors=[${cssSelectors.join(", ")}]`
    )
    const browser = await launchBrowser()

    try {
      const page = await browser.newPage()
      const result = await this.renderPage(page, url, cssSelectors, execute)

      const duration = this.clock.timestamp().getTime() - startTime.getTime()
      logger.info(
        `Completed action=${action} url=${url} duration=${duration}ms`
      )

      return result
    } catch (exception) {
      logger.error(
        `Failed action=${action} url=${url} error=${errorMessage(exception)}`
      )
      throw exception
    } finally {
      await browser.close()
    }
  }

  /**
   * Everything that happens on the page is at the mercy of the requested URL,
   * so any failure here is reported as a `RenderingError`.
   */
  private async renderPage<A>(
    page: Page,
    url: string,
    cssSelectors: string[],
    execute: (page: Page) => Promise<A>
  ): Promise<A> {
    try {
      await page.goto(url, { waitUntil: "load" })

      for (const cssSelector of cssSelectors) {
        await page.waitForSelector(cssSelector, {
          timeout: this.selectorTimeoutMs,
        })
      }

      return await execute(page)
    } catch (exception) {
      throw new RenderingError(errorMessage(exception), exception)
    }
  }
}
