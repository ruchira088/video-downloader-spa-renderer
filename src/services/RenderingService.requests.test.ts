import puppeteer from "puppeteer"
import { PuppeteerRenderingService } from "./RenderingService"
import { fixedClock } from "../test/FixedClock"
import {
  asBrowser,
  asRequest,
  createMockBrowser,
  createMockPage,
  createMockRequest,
  MockBrowser,
  MockPage,
  requestHandlerOf,
} from "../test/MockBrowser"
import { allowAllHosts, HostPolicy } from "./HostPolicy"

// Every request the page makes passes through the `HostPolicy`. Puppeteer is
// mocked so that the registered request handler can be driven directly; the
// same behaviour against a real Chromium is covered by
// `RenderingService.integration.test.ts`.
jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}))

const mockedLaunch = puppeteer.launch as jest.MockedFunction<
  typeof puppeteer.launch
>

describe("RenderingService request interception", () => {
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

  const blocking = (
    ...blockedHostnames: string[]
  ): jest.Mocked<HostPolicy> => ({
    isAllowed: jest.fn((hostname: string) =>
      Promise.resolve(!blockedHostnames.includes(hostname))
    ),
  })

  test("consults the policy about the requested host before launching a browser", async () => {
    const hostPolicy = blocking()

    await createRenderingService(hostPolicy).render(
      "https://example.com/page",
      null
    )

    expect(hostPolicy.isAllowed).toHaveBeenCalledWith("example.com")
    expect(hostPolicy.isAllowed.mock.invocationCallOrder[0]).toBeLessThan(
      mockedLaunch.mock.invocationCallOrder[0]
    )
  })

  test("intercepts requests before navigating", async () => {
    await createRenderingService().render("https://example.com", null)

    expect(page.setRequestInterception).toHaveBeenCalledWith(true)
    expect(
      page.setRequestInterception.mock.invocationCallOrder[0]
    ).toBeLessThan(page.goto.mock.invocationCallOrder[0])
    expect(page.on.mock.invocationCallOrder[0]).toBeLessThan(
      page.goto.mock.invocationCallOrder[0]
    )
  })

  test("lets a request to an allowed host through", async () => {
    await createRenderingService(blocking("internal")).render(
      "https://example.com",
      null
    )

    const request = createMockRequest("https://cdn.example.com/app.js")
    await requestHandlerOf(page)(asRequest(request))

    expect(request.continue).toHaveBeenCalledTimes(1)
    expect(request.abort).not.toHaveBeenCalled()
  })

  test("aborts a request to a blocked host", async () => {
    await createRenderingService(blocking("internal")).render(
      "https://example.com",
      null
    )

    const request = createMockRequest("http://internal/secret")
    await requestHandlerOf(page)(asRequest(request))

    expect(request.abort).toHaveBeenCalledWith("blockedbyclient")
    expect(request.continue).not.toHaveBeenCalled()
  })

  test("passes an IPv6 literal to the policy with its brackets", async () => {
    const hostPolicy = blocking()

    await createRenderingService(hostPolicy).render("https://example.com", null)

    await requestHandlerOf(page)(
      asRequest(createMockRequest("http://[::1]:8080/"))
    )

    expect(hostPolicy.isAllowed).toHaveBeenCalledWith("[::1]")
  })

  test("consults the policy once per host during a render", async () => {
    const hostPolicy = blocking()

    await createRenderingService(hostPolicy).render("https://example.com", null)

    const handler = requestHandlerOf(page)
    await handler(asRequest(createMockRequest("https://example.com/a.css")))
    await handler(asRequest(createMockRequest("https://example.com/b.js")))
    await handler(asRequest(createMockRequest("https://cdn.example.com/c")))

    expect(hostPolicy.isAllowed).toHaveBeenCalledTimes(2)
  })

  test("consults the policy afresh for every render", async () => {
    const hostPolicy = blocking()
    const renderingService = createRenderingService(hostPolicy)

    await renderingService.render("https://example.com", null)
    await renderingService.render("https://example.com", null)

    expect(hostPolicy.isAllowed).toHaveBeenCalledTimes(2)
  })

  test("swallows a failure to continue a request once the page is gone", async () => {
    await createRenderingService().render("https://example.com", null)

    const request = createMockRequest("https://example.com/late.js")
    request.continue.mockRejectedValue(new Error("Request is already handled!"))

    await expect(
      requestHandlerOf(page)(asRequest(request))
    ).resolves.toBeUndefined()
  })

  test.each([
    [
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    ],
    ["blob:https://example.com/3b1d2c9a-8b5e-4f2a-9c7d-1e6f5a4b3c2d"],
    ["about:blank"],
  ])(
    "lets the non-network URL %s through without consulting the policy",
    async (url) => {
      const hostPolicy = blocking()

      await createRenderingService(hostPolicy).render(
        "https://example.com",
        null
      )
      hostPolicy.isAllowed.mockClear()

      const request = createMockRequest(url)
      await requestHandlerOf(page)(asRequest(request))

      expect(request.continue).toHaveBeenCalledTimes(1)
      expect(hostPolicy.isAllowed).not.toHaveBeenCalled()
    }
  )

  test("aborts a request whose URL cannot be parsed", async () => {
    await createRenderingService().render("https://example.com", null)

    const request = createMockRequest("not a url")
    await requestHandlerOf(page)(asRequest(request))

    expect(request.abort).toHaveBeenCalledWith("blockedbyclient")
  })
})
