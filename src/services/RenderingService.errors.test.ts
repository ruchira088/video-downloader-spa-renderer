import puppeteer from "puppeteer"
import { PuppeteerRenderingService, RenderingError } from "./RenderingService"
import { Clock } from "../utils/Clock"
import {
  asBrowser,
  createMockBrowser,
  createMockPage,
  MockBrowser,
  MockPage,
} from "../test/MockBrowser"

// Failures of the request itself are reported as a `RenderingError` so that
// the router can answer with a 400, while failures of the renderer are left
// alone so that they surface as a 500. Puppeteer is mocked to make each
// failure reachable.
jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}))

const mockedLaunch = puppeteer.launch as jest.MockedFunction<
  typeof puppeteer.launch
>

describe("RenderingService error classification", () => {
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

  describe("URL validation", () => {
    test.each([
      ["file:///etc/passwd", "file:"],
      ["data:text/html,<h1>Hello</h1>", "data:"],
      ["javascript:alert(1)", "javascript:"],
      ["ftp://example.com/file.txt", "ftp:"],
      ["ws://example.com", "ws:"],
    ])("rejects the %s URL", async (url, protocol) => {
      await expect(createRenderingService().render(url, null)).rejects.toThrow(
        `Invalid URL protocol: ${protocol}. Only http and https are allowed.`
      )
    })

    test("rejects a malformed URL", async () => {
      await expect(
        createRenderingService().render("not-a-valid-url", null)
      ).rejects.toThrow("Invalid URL: not-a-valid-url")
    })

    test.each(["file:///etc/passwd", "not-a-valid-url"])(
      "reports %s as a request failure",
      async (url) => {
        await expect(
          createRenderingService().render(url, null)
        ).rejects.toBeInstanceOf(RenderingError)
      }
    )

    test("applies the same validation to execute", async () => {
      await expect(
        createRenderingService().execute(
          "file:///etc/passwd",
          "document.title",
          null
        )
      ).rejects.toThrow(
        "Invalid URL protocol: file:. Only http and https are allowed."
      )
    })

    test("does not launch a browser when the URL is rejected", async () => {
      await expect(
        createRenderingService().render("file:///etc/passwd", null)
      ).rejects.toThrow()

      expect(mockedLaunch).not.toHaveBeenCalled()
    })

    test.each(["http://example.com", "https://example.com"])(
      "accepts the %s URL",
      async (url) => {
        await expect(
          createRenderingService().render(url, null)
        ).resolves.toBeDefined()
      }
    )
  })

  describe("browser cleanup", () => {
    test.each([
      ["navigation fails", "goto", "net::ERR_CONNECTION_REFUSED"],
      [
        "a selector never appears",
        "waitForSelector",
        "Waiting for selector `#missing` failed",
      ],
      ["capturing the content fails", "content", "Session closed"],
    ] as const)(
      "closes the browser when %s",
      async (_description, method, message) => {
        page[method].mockRejectedValue(new Error(message))

        await expect(
          createRenderingService().render("https://example.com", ["#missing"])
        ).rejects.toThrow(message)

        expect(browser.close).toHaveBeenCalledTimes(1)
      }
    )

    test("closes the browser when the executed script throws", async () => {
      page.evaluate.mockRejectedValue(new ReferenceError("foo is not defined"))

      await expect(
        createRenderingService().execute("https://example.com", "foo()", null)
      ).rejects.toThrow("foo is not defined")

      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test("launches a fresh browser for every request", async () => {
      const renderingService = createRenderingService()

      await renderingService.render("https://example.com", null)
      await renderingService.render("https://example.com", null)

      expect(mockedLaunch).toHaveBeenCalledTimes(2)
      expect(browser.close).toHaveBeenCalledTimes(2)
    })
  })

  describe("errors attributable to the request", () => {
    test.each([
      ["navigation fails", "goto", "net::ERR_CONNECTION_REFUSED"],
      [
        "a selector never appears",
        "waitForSelector",
        "Waiting for selector `#missing` failed",
      ],
      ["capturing the content fails", "content", "Session closed"],
    ] as const)(
      "reports a RenderingError when %s",
      async (_description, method, message) => {
        page[method].mockRejectedValue(new Error(message))

        await expect(
          createRenderingService().render("https://example.com", ["#missing"])
        ).rejects.toThrow(message)

        await expect(
          createRenderingService().render("https://example.com", ["#missing"])
        ).rejects.toBeInstanceOf(RenderingError)
      }
    )

    test("reports a RenderingError when the executed script throws", async () => {
      page.evaluate.mockRejectedValue(new ReferenceError("foo is not defined"))

      await expect(
        createRenderingService().execute("https://example.com", "foo()", null)
      ).rejects.toBeInstanceOf(RenderingError)
    })

    // `run` takes a caller supplied callback, so it may already be handed a
    // RenderingError. Wrapping it again would bury the original message.
    test("does not wrap a RenderingError a second time", async () => {
      const failure = new RenderingError("Already classified")

      const exception: unknown = await createRenderingService()
        .run(
          "https://example.com",
          null,
          () => Promise.reject(failure),
          "rendered"
        )
        .catch((error: unknown) => error)

      expect(exception).toBe(failure)
    })

    test("retains the original failure as the cause", async () => {
      const cause = new Error("net::ERR_CONNECTION_REFUSED")
      page.goto.mockRejectedValue(cause)

      const exception: unknown = await createRenderingService()
        .render("https://example.com", null)
        .catch((error: unknown) => error)

      expect(exception).toBeInstanceOf(RenderingError)
      expect((exception as RenderingError).cause).toBe(cause)
    })
  })

  describe("errors attributable to the renderer", () => {
    test("does not wrap a browser launch failure", async () => {
      mockedLaunch.mockRejectedValue(
        new Error("Failed to launch the browser process")
      )

      await expect(
        createRenderingService().render("https://example.com", null)
      ).rejects.not.toBeInstanceOf(RenderingError)
    })

    test("does not wrap a failure to open a page", async () => {
      browser.newPage.mockRejectedValue(new Error("Target closed"))

      await expect(
        createRenderingService().render("https://example.com", null)
      ).rejects.not.toBeInstanceOf(RenderingError)
    })

    test("still closes the browser when opening a page fails", async () => {
      browser.newPage.mockRejectedValue(new Error("Target closed"))

      await expect(
        createRenderingService().render("https://example.com", null)
      ).rejects.toThrow("Target closed")

      expect(browser.close).toHaveBeenCalledTimes(1)
    })
  })
})
