import puppeteer, { Browser, Page } from "puppeteer"
import { Logger } from "winston"
import { create as createLogger } from "../logger/Logger"
import { Clock } from "../utils/Clock"
import { abortable, errorMessage, Optional } from "../utils/Helpers"
import { RenderingError } from "./RenderingError"
import { HostPolicy } from "./HostPolicy"
import { RequestFilter } from "./RequestFilter"
import { RenderLimiter } from "./RenderLimiter"
import { RendererBusyError } from "./RendererBusyError"

/**
 * Aborting `signal` abandons the render: the browser is closed and the
 * returned promise rejects with the abort reason.
 */
export interface RenderingService {
  render(
    url: string,
    readyCssSelectors: Optional<string[]>,
    signal?: AbortSignal
  ): Promise<string>

  execute(
    url: string,
    js: string,
    readyCssSelectors: Optional<string[]>,
    signal?: AbortSignal
  ): Promise<unknown>
}

export type RenderingOptions = {
  /** How long to wait for each of the `readyCssSelectors`. */
  readonly selectorTimeoutMs: number
  /** How long a render may take in all, including time spent queued. */
  readonly renderTimeoutMs: number
  /** How many browsers may run at once. */
  readonly maxConcurrentRenders: number
  /** How many renders may wait for a browser before new ones are rejected. */
  readonly maxQueuedRenders: number
}

const DEFAULT_RENDERING_OPTIONS: RenderingOptions = {
  selectorTimeoutMs: 30_000,
  renderTimeoutMs: 60_000,
  maxConcurrentRenders: 4,
  maxQueuedRenders: 8,
}

const ALLOWED_PROTOCOLS = ["http:", "https:"]

const launchBrowser = (): Promise<Browser> =>
  puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    headless: true,
  })

const parseUrl = (url: string): URL => {
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

  return parsed
}

type Action = "render" | "execute"

const logger: Logger = createLogger(__filename)

export class PuppeteerRenderingService implements RenderingService {
  private readonly options: RenderingOptions
  private readonly limiter: RenderLimiter

  constructor(
    private readonly clock: Clock,
    private readonly hostPolicy: HostPolicy,
    options: Partial<RenderingOptions> = {}
  ) {
    // An option given as `undefined` falls back to its default rather than
    // overriding it.
    this.options = {
      ...DEFAULT_RENDERING_OPTIONS,
      ...Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined)
      ),
    }
    this.limiter = new RenderLimiter(
      this.options.maxConcurrentRenders,
      this.options.maxQueuedRenders
    )
  }

  render(
    url: string,
    readyCssSelectors: Optional<string[]>,
    signal?: AbortSignal
  ): Promise<string> {
    return this.run("render", url, readyCssSelectors, signal, (page) =>
      page.content()
    )
  }

  execute(
    url: string,
    js: string,
    readyCssSelectors: Optional<string[]>,
    signal?: AbortSignal
  ): Promise<unknown> {
    return this.run("execute", url, readyCssSelectors, signal, (page) =>
      page.evaluate(js)
    )
  }

  /**
   * Validates the request, then waits for a free browser slot. The deadline
   * starts here, so time spent queued counts towards it.
   */
  private async run<A>(
    action: Action,
    url: string,
    readyCssSelectors: Optional<string[]>,
    callerSignal: AbortSignal | undefined,
    execute: (page: Page) => Promise<A>
  ): Promise<A> {
    const startTime = this.clock.timestamp()

    const { hostname } = parseUrl(url)
    const requestFilter = new RequestFilter(this.hostPolicy)

    if (!(await requestFilter.isAllowed(hostname))) {
      throw new RenderingError(`Blocked host: ${hostname}`)
    }

    const cssSelectors = readyCssSelectors ?? []

    const { renderTimeoutMs } = this.options
    const deadline = new AbortController()
    const timer = setTimeout(() => {
      deadline.abort(
        new RenderingError(
          `Render did not complete within ${renderTimeoutMs}ms`
        )
      )
    }, renderTimeoutMs)

    const signal =
      callerSignal === undefined
        ? deadline.signal
        : AbortSignal.any([callerSignal, deadline.signal])

    let started = false

    try {
      return await this.limiter.run(() => {
        started = true

        return this.renderInBrowser(
          action,
          url,
          requestFilter,
          cssSelectors,
          signal,
          startTime,
          execute
        )
      }, signal)
    } catch (exception) {
      // Running out of time before a browser was free is a matter of
      // capacity, not of the page, so the client is told to retry.
      if (!started && exception === deadline.signal.reason) {
        throw new RendererBusyError()
      }

      throw exception
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Launches a fresh browser for the request and closes it once the page has
   * been rendered, whatever the outcome. Closing it is also what stops the
   * work on the page when `signal` aborts.
   */
  private async renderInBrowser<A>(
    action: Action,
    url: string,
    requestFilter: RequestFilter,
    cssSelectors: string[],
    signal: AbortSignal,
    startTime: Date,
    execute: (page: Page) => Promise<A>
  ): Promise<A> {
    logger.info(
      `Rendering url=${url} with readyCssSelectors=[${cssSelectors.join(", ")}]`
    )
    const browser = await launchBrowser()

    try {
      const result = await abortable(
        browser
          .newPage()
          .then((page) =>
            this.renderPage(page, requestFilter, url, cssSelectors, execute)
          ),
        signal
      )

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
    requestFilter: RequestFilter,
    url: string,
    cssSelectors: string[],
    execute: (page: Page) => Promise<A>
  ): Promise<A> {
    try {
      await page.setRequestInterception(true)
      page.on("request", (request) => requestFilter.handle(request))

      await page.goto(url, { waitUntil: "load" })

      for (const cssSelector of cssSelectors) {
        await page.waitForSelector(cssSelector, {
          timeout: this.options.selectorTimeoutMs,
        })
      }

      return await execute(page)
    } catch (exception) {
      throw new RenderingError(errorMessage(exception), exception)
    }
  }
}
