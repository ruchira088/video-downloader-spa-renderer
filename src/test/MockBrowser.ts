import { Browser, Page } from "puppeteer"

/**
 * The subset of the Puppeteer `Page` API that `PuppeteerRenderingService`
 * drives, backed by Jest mocks.
 */
export type MockPage = {
  goto: jest.Mock
  waitForSelector: jest.Mock
  content: jest.Mock
  evaluate: jest.Mock
}

export type MockBrowser = {
  newPage: jest.Mock
  close: jest.Mock
}

export const createMockPage = (): MockPage => ({
  goto: jest.fn().mockResolvedValue(null),
  waitForSelector: jest.fn().mockResolvedValue(null),
  content: jest.fn().mockResolvedValue("<html><body>Hello</body></html>"),
  evaluate: jest.fn().mockResolvedValue("evaluated"),
})

export const createMockBrowser = (page: MockPage): MockBrowser => ({
  newPage: jest.fn().mockResolvedValue(page as unknown as Page),
  close: jest.fn(() => Promise.resolve()),
})

export const asBrowser = (browser: MockBrowser): Browser =>
  browser as unknown as Browser
