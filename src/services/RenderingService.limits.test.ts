import puppeteer from "puppeteer"
import { PuppeteerRenderingService, RenderingOptions } from "./RenderingService"
import { fixedClock } from "../test/FixedClock"
import {
  asBrowser,
  createMockBrowser,
  createMockPage,
  MockBrowser,
  MockPage,
} from "../test/MockBrowser"
import { allowAllHosts } from "./HostPolicy"
import { RenderingError } from "./RenderingError"
import { RendererBusyError } from "./RendererBusyError"

// How `PuppeteerRenderingService` bounds the resources a render may hold:
// the overall deadline, cancellation by the caller and the cap on concurrent
// browsers.
jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}))

const mockedLaunch = puppeteer.launch as jest.MockedFunction<
  typeof puppeteer.launch
>

const never = <A>(): Promise<A> =>
  new Promise<A>(() => {
    /* never settles */
  })

describe("RenderingService limits", () => {
  let page: MockPage
  let browser: MockBrowser

  const createRenderingService = (
    options: Partial<RenderingOptions> = {}
  ): PuppeteerRenderingService =>
    new PuppeteerRenderingService(fixedClock(), allowAllHosts, options)

  beforeEach(() => {
    jest.useFakeTimers()

    page = createMockPage()
    browser = createMockBrowser(page)

    mockedLaunch.mockResolvedValue(asBrowser(browser))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe("deadline", () => {
    test("closes the browser and rejects with a RenderingError once the render outlives it", async () => {
      page.goto.mockReturnValue(never())

      const result = createRenderingService({ renderTimeoutMs: 1_000 })
        .render("https://example.com", null)
        .catch((error: unknown) => error)

      await jest.advanceTimersByTimeAsync(999)
      expect(browser.close).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(1)

      const error = await result
      expect(error).toBeInstanceOf(RenderingError)
      expect(error).toHaveProperty(
        "message",
        "Render did not complete within 1000ms"
      )
      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test("bounds a script that never returns", async () => {
      page.evaluate.mockReturnValue(never())

      const result = createRenderingService({ renderTimeoutMs: 1_000 })
        .execute("https://example.com", "while (true) {}", null)
        .catch((error: unknown) => error)

      await jest.advanceTimersByTimeAsync(1_000)

      expect(await result).toBeInstanceOf(RenderingError)
      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test("defaults to 60s", async () => {
      page.goto.mockReturnValue(never())

      const result = createRenderingService()
        .render("https://example.com", null)
        .catch((error: unknown) => error)

      await jest.advanceTimersByTimeAsync(59_999)
      expect(browser.close).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(1)
      expect(await result).toBeInstanceOf(RenderingError)
    })

    test("clears its timer once the render completes", async () => {
      const timersBefore = jest.getTimerCount()

      await createRenderingService().render("https://example.com", null)
      // Logging schedules immediates of its own; only the deadline may remain.
      await jest.advanceTimersByTimeAsync(0)

      expect(jest.getTimerCount()).toBe(timersBefore)
    })
  })

  describe("cancellation", () => {
    test("closes the browser and rejects with the caller's reason when the caller aborts", async () => {
      page.goto.mockReturnValue(never())
      const controller = new AbortController()
      const reason = new Error("Health check timed out")

      const result = createRenderingService()
        .render("https://example.com", null, controller.signal)
        .catch((error: unknown) => error)

      await jest.advanceTimersByTimeAsync(0)
      controller.abort(reason)

      expect(await result).toBe(reason)
      expect(browser.close).toHaveBeenCalledTimes(1)
    })

    test("does not launch a browser for a caller that has already given up", async () => {
      const reason = new Error("Too late")

      await expect(
        createRenderingService().render(
          "https://example.com",
          null,
          AbortSignal.abort(reason)
        )
      ).rejects.toBe(reason)

      expect(mockedLaunch).not.toHaveBeenCalled()
    })
  })

  describe("concurrency", () => {
    test("rejects with a RendererBusyError, without launching a browser, once the limit and queue are full", async () => {
      page.goto.mockReturnValue(never())
      const renderingService = createRenderingService({
        maxConcurrentRenders: 1,
        maxQueuedRenders: 0,
      })

      void renderingService
        .render("https://example.com", null)
        .catch(() => null)
      await jest.advanceTimersByTimeAsync(0)

      await expect(
        renderingService.render("https://example.com", null)
      ).rejects.toBeInstanceOf(RendererBusyError)

      expect(mockedLaunch).toHaveBeenCalledTimes(1)
    })

    test("starts a queued render once a running one finishes", async () => {
      let finishFirst!: () => void
      page.goto
        .mockReturnValueOnce(
          new Promise((resolve) => {
            finishFirst = () => resolve(null)
          })
        )
        .mockResolvedValue(null)
      const renderingService = createRenderingService({
        maxConcurrentRenders: 1,
        maxQueuedRenders: 1,
      })

      const first = renderingService.render("https://example.com/1", null)
      const second = renderingService.render("https://example.com/2", null)
      await jest.advanceTimersByTimeAsync(0)

      expect(mockedLaunch).toHaveBeenCalledTimes(1)

      finishFirst()
      await Promise.all([first, second])

      expect(mockedLaunch).toHaveBeenCalledTimes(2)
    })

    // Waiting for a slot counts towards the deadline, but running out of time
    // in the queue is a capacity problem rather than a fault of the page.
    test("rejects with a RendererBusyError when the deadline passes while queued", async () => {
      page.goto.mockReturnValue(never())
      // The running render keeps its slot until its browser has closed.
      browser.close.mockReturnValue(never())
      const renderingService = createRenderingService({
        renderTimeoutMs: 1_000,
        maxConcurrentRenders: 1,
        maxQueuedRenders: 1,
      })

      void renderingService
        .render("https://example.com/1", null)
        .catch(() => null)
      await jest.advanceTimersByTimeAsync(500)

      const queued = renderingService
        .render("https://example.com/2", null)
        .catch((error: unknown) => error)

      await jest.advanceTimersByTimeAsync(1_000)

      expect(await queued).toBeInstanceOf(RendererBusyError)
      expect(mockedLaunch).toHaveBeenCalledTimes(1)
    })
  })
})
