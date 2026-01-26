import { PuppeteerRenderingService } from "./RenderingService"
import { Clock } from "../utils/Clock"

describe("RenderingService", () => {
  const mockClock: Clock = {
    timestamp: () => new Date("2024-01-01T00:00:00.000Z"),
  }

  describe("URL validation", () => {
    const renderingService = new PuppeteerRenderingService(mockClock)

    test("rejects file:// protocol", async () => {
      await expect(
        renderingService.render("file:///etc/passwd", null)
      ).rejects.toThrow(
        "Invalid URL protocol: file:. Only http and https are allowed."
      )
    })

    test("rejects data: protocol", async () => {
      await expect(
        renderingService.render("data:text/html,<h1>Hello</h1>", null)
      ).rejects.toThrow(
        "Invalid URL protocol: data:. Only http and https are allowed."
      )
    })

    test("rejects javascript: protocol", async () => {
      await expect(
        renderingService.render("javascript:alert(1)", null)
      ).rejects.toThrow(
        "Invalid URL protocol: javascript:. Only http and https are allowed."
      )
    })

    test("rejects invalid URL format", async () => {
      await expect(
        renderingService.render("not-a-valid-url", null)
      ).rejects.toThrow()
    })
  })
})
