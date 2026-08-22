import puppeteer from "puppeteer"
import { launchBrowser, PuppeteerRenderingService } from "./RenderingService"
import { Clock } from "../utils/Clock"
import {
  asBrowser,
  createMockBrowser,
  createMockPage,
  MockBrowser,
  MockPage,
} from "../test/MockBrowser"

// Puppeteer is mocked so that these tests cover the control flow of
// `PuppeteerRenderingService` deterministically. Error classification lives in
// `RenderingService.errors.test.ts` and the behaviour against a real Chromium
// in `RenderingService.integration.test.ts`.
jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}))

const mockedLaunch = puppeteer.launch as jest.MockedFunction<
  typeof puppeteer.launch
>

describe("RenderingService", () => {
  const mockClock: Clock = {
    timestamp: () => new Date("2024-01-01T00:00:00.000Z"),
  }

  let page: MockPage
  let browser: MockBrowser

  const createRenderingService = (): PuppeteerRenderingService =>
    new PuppeteerRenderingService(mockClock)

  beforeEach(() => {
    page = createMockPage()
    browser = createMockBrowser(page)

    mockedLaunch.mockResolvedValue(asBrowser(browser))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("launchBrowser", () => {
    test("launches a headless browser without the Chromium sandbox", async () => {
      await launchBrowser()

      expect(mockedLaunch).toHaveBeenCalledWith({
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
        headless: true,
      })
    })
  })

  describe("render", () => {
    test("returns the page content and closes the browser", async () => {
      const content = await createRenderingService().render(
        "https://example.com",
        null
      )

      expect(content).toBe("<html><body>Hello</body></html>")
      expect(browser.newPage).toHaveBeenCalledTimes(1)
      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test.each([
      ["null", null],
      ["undefined", undefined],
      ["an empty array", []],
    ])(
      "waits for the load event when readyCssSelectors is %s",
      async (_description, readyCssSelectors) => {
        await createRenderingService().render(
          "https://example.com",
          readyCssSelectors
        )

        expect(page.goto).toHaveBeenCalledWith("https://example.com", {
          waitUntil: "load",
        })
        expect(page.waitForSelector).not.toHaveBeenCalled()
      }
    )

    test("does not wait for the load event when selectors are supplied", async () => {
      await createRenderingService().render("https://example.com", ["#app"])

      expect(page.goto).toHaveBeenCalledWith("https://example.com", {
        waitUntil: undefined,
      })
    })

    test("waits for every selector with the default 30s timeout", async () => {
      await createRenderingService().render("https://example.com", [
        "#first",
        ".second",
      ])

      expect(page.waitForSelector).toHaveBeenCalledTimes(2)
      expect(page.waitForSelector).toHaveBeenNthCalledWith(1, "#first", {
        timeout: 30_000,
      })
      expect(page.waitForSelector).toHaveBeenNthCalledWith(2, ".second", {
        timeout: 30_000,
      })
    })

    test("waits for the selectors sequentially rather than concurrently", async () => {
      const events: string[] = []

      page.waitForSelector.mockImplementation(async (selector: string) => {
        events.push(`start:${selector}`)
        await new Promise((resolve) => {
          setImmediate(resolve)
        })
        events.push(`end:${selector}`)
        return null
      })

      await createRenderingService().render("https://example.com", [
        "#first",
        ".second",
      ])

      expect(events).toEqual([
        "start:#first",
        "end:#first",
        "start:.second",
        "end:.second",
      ])
    })

    test("captures the content only once every selector is present", async () => {
      const events: string[] = []

      page.waitForSelector.mockImplementation((selector: string) => {
        events.push(`selector:${selector}`)
        return Promise.resolve(null)
      })
      page.content.mockImplementation(() => {
        events.push("content")
        return Promise.resolve("<html></html>")
      })

      await createRenderingService().render("https://example.com", [
        "#first",
        ".second",
      ])

      expect(events).toEqual(["selector:#first", "selector:.second", "content"])
    })
  })

  describe("execute", () => {
    test("evaluates the supplied script and returns its result", async () => {
      page.evaluate.mockResolvedValue("Page title")

      const result = await createRenderingService().execute(
        "https://example.com",
        "document.title",
        null
      )

      expect(result).toBe("Page title")
      expect(page.evaluate).toHaveBeenCalledWith("document.title")
      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test("waits for the selectors before evaluating the script", async () => {
      const events: string[] = []

      page.waitForSelector.mockImplementation((selector: string) => {
        events.push(`selector:${selector}`)
        return Promise.resolve(null)
      })
      page.evaluate.mockImplementation(() => {
        events.push("evaluate")
        return Promise.resolve("result")
      })

      await createRenderingService().execute(
        "https://example.com",
        "document.title",
        ["#app"]
      )

      expect(events).toEqual(["selector:#app", "evaluate"])
    })
  })
})
