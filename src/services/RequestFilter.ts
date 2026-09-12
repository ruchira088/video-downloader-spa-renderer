import { HTTPRequest } from "puppeteer"
import { Logger } from "winston"
import { create as createLogger } from "../logger/Logger"
import { errorMessage } from "../utils/Helpers"
import { HostPolicy } from "./HostPolicy"

const logger: Logger = createLogger(__filename)

const NETWORK_PROTOCOLS = ["http:", "https:"]

/**
 * The `HostPolicy` consulted for every request the page makes, remembering
 * each verdict so that a host is resolved once per render rather than once
 * per asset.
 */
export class RequestFilter {
  private readonly verdicts = new Map<string, Promise<boolean>>()

  constructor(private readonly hostPolicy: HostPolicy) {}

  isAllowed(hostname: string): Promise<boolean> {
    let verdict = this.verdicts.get(hostname)

    if (verdict === undefined) {
      verdict = this.hostPolicy.isAllowed(hostname)
      this.verdicts.set(hostname, verdict)
    }

    return verdict
  }

  /**
   * Aborting a blocked request leaves the page to render without that
   * resource; a blocked navigation makes `page.goto` fail instead.
   */
  async handle(request: HTTPRequest): Promise<void> {
    const url = request.url()

    try {
      if (await this.permits(url)) {
        await request.continue()
      } else {
        logger.warn(`Blocked request to url=${url}`)
        await request.abort("blockedbyclient")
      }
    } catch (exception) {
      // Puppeteer ignores the promise returned by an event handler, so a
      // request that can no longer be answered (the page has gone away) must
      // not surface as an unhandled rejection.
      logger.warn(
        `Failed to handle request to url=${url} error=${errorMessage(exception)}`
      )
    }
  }

  /**
   * Only `http` and `https` requests reach a host. Chromium hands the other
   * schemes it intercepts (`data:`, `blob:`, `about:`) to the page without
   * touching the network, so they pass through unchecked.
   */
  private permits(url: string): Promise<boolean> {
    let parsed: URL

    try {
      parsed = new URL(url)
    } catch {
      return Promise.resolve(false)
    }

    return NETWORK_PROTOCOLS.includes(parsed.protocol)
      ? this.isAllowed(parsed.hostname)
      : Promise.resolve(true)
  }
}
