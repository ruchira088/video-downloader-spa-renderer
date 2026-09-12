import puppeteer from "puppeteer"
import { PuppeteerRenderingService } from "./RenderingService"
import { RenderingError } from "./RenderingError"
import { fixedClock } from "../test/FixedClock"
import {
  asBrowser,
  createMockBrowser,
  createMockPage,
  MockBrowser,
  MockPage,
} from "../test/MockBrowser"
import { allowAllHosts, HostPolicy } from "./HostPolicy"

// Failures of the request itself are reported as a `RenderingError` so that
// the error handler can answer with a 400, while failures of the renderer are
// left alone so that they surface as a 500. Puppeteer is mocked to make each
// failure reachable.
jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}))

const mockedLaunch = puppeteer.launch as jest.MockedFunction<
  typeof puppeteer.launch
>

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error("Expected the promise to reject")
    },
    (error: unknown) => error
  )

describe("RenderingService error classification", () => {
  let page: MockPage
  let browser: MockBrowser

  const createRenderingService = (
    hostPolicy: HostPolicy = allowAllHosts
  ): PuppeteerRenderingService =>
    new PuppeteerRenderingService(fixedClock(), hostPolicy)

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

  describe("host policy", () => {
    const blockEverything: HostPolicy = {
      isAllowed: () => Promise.resolve(false),
    }

    test("reports a blocked host as a request failure", async () => {
      const exception = await rejectionOf(
        createRenderingService(blockEverything).render(
          "http://169.254.169.254/latest/meta-data/",
          null
        )
      )

      expect(exception).toBeInstanceOf(RenderingError)
      expect(exception).toMatchObject({
        message: "Blocked host: 169.254.169.254",
      })
    })

    test("does not launch a browser when the host is blocked", async () => {
      await expect(
        createRenderingService(blockEverything).render("http://10.0.0.5/", null)
      ).rejects.toThrow("Blocked host: 10.0.0.5")

      expect(mockedLaunch).not.toHaveBeenCalled()
    })

    test("applies the policy to execute", async () => {
      await expect(
        createRenderingService(blockEverything).execute(
          "http://localhost:8000/",
          "document.title",
          null
        )
      ).rejects.toThrow("Blocked host: localhost")
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
      "reports a RenderingError and closes the browser when %s",
      async (_description, method, message) => {
        const cause = new Error(message)
        page[method].mockRejectedValue(cause)

        const exception = await rejectionOf(
          createRenderingService().render("https://example.com", ["#missing"])
        )

        expect(exception).toBeInstanceOf(RenderingError)
        expect(exception).toMatchObject({ message, cause })
        expect(browser.close).toHaveBeenCalledTimes(1)
      }
    )

    test("reports a RenderingError and closes the browser when the executed script throws", async () => {
      page.evaluate.mockRejectedValue(new ReferenceError("foo is not defined"))

      const exception = await rejectionOf(
        createRenderingService().execute("https://example.com", "foo()", null)
      )

      expect(exception).toBeInstanceOf(RenderingError)
      expect(exception).toMatchObject({ message: "foo is not defined" })
      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test("describes a rejection that is not an Error", async () => {
      page.goto.mockRejectedValue("connection dropped")

      await expect(
        createRenderingService().render("https://example.com", null)
      ).rejects.toThrow("connection dropped")
    })

    test("launches a fresh browser for every request", async () => {
      const renderingService = createRenderingService()

      await renderingService.render("https://example.com", null)
      await renderingService.render("https://example.com", null)

      expect(mockedLaunch).toHaveBeenCalledTimes(2)
      expect(browser.close).toHaveBeenCalledTimes(2)
    })
  })

  describe("errors attributable to the renderer", () => {
    test("does not wrap a browser launch failure", async () => {
      mockedLaunch.mockRejectedValue(
        new Error("Failed to launch the browser process")
      )

      const exception = await rejectionOf(
        createRenderingService().render("https://example.com", null)
      )

      expect(exception).not.toBeInstanceOf(RenderingError)
      expect(exception).toMatchObject({
        message: "Failed to launch the browser process",
      })
    })

    test("does not wrap a failure to open a page, but still closes the browser", async () => {
      browser.newPage.mockRejectedValue(new Error("Target closed"))

      const exception = await rejectionOf(
        createRenderingService().render("https://example.com", null)
      )

      expect(exception).not.toBeInstanceOf(RenderingError)
      expect(exception).toMatchObject({ message: "Target closed" })
      expect(browser.close).toHaveBeenCalledTimes(1)
    })
  })
})
