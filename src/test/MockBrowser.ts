import { Browser, HTTPRequest, Page } from "puppeteer"

/**
 * The subset of the Puppeteer `Page` API that `PuppeteerRenderingService`
 * drives, backed by Jest mocks.
 */
export type MockPage = {
  goto: jest.Mock
  waitForSelector: jest.Mock
  content: jest.Mock
  evaluate: jest.Mock
  setRequestInterception: jest.Mock
  on: jest.Mock
}

export type MockBrowser = {
  newPage: jest.Mock
  close: jest.Mock
}

export type MockRequest = {
  url: jest.Mock
  continue: jest.Mock
  abort: jest.Mock
}

export const createMockPage = (): MockPage => ({
  goto: jest.fn().mockResolvedValue(null),
  waitForSelector: jest.fn().mockResolvedValue(null),
  content: jest.fn().mockResolvedValue("<html><body>Hello</body></html>"),
  evaluate: jest.fn().mockResolvedValue("evaluated"),
  setRequestInterception: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
})

export const createMockBrowser = (page: MockPage): MockBrowser => ({
  newPage: jest.fn().mockResolvedValue(page as unknown as Page),
  close: jest.fn(() => Promise.resolve()),
})

export const createMockRequest = (url: string): MockRequest => ({
  url: jest.fn().mockReturnValue(url),
  continue: jest.fn(() => Promise.resolve()),
  abort: jest.fn(() => Promise.resolve()),
})

/** The handler that the service registered for the page's `request` event. */
export const requestHandlerOf = (
  page: MockPage
): ((request: HTTPRequest) => Promise<void>) => {
  const registration = page.on.mock.calls.find(([event]) => event === "request")

  if (registration === undefined) {
    throw new Error("No request handler was registered on the page")
  }

  return registration[1]
}

export const asBrowser = (browser: MockBrowser): Browser =>
  browser as unknown as Browser

export const asRequest = (request: MockRequest): HTTPRequest =>
  request as unknown as HTTPRequest
