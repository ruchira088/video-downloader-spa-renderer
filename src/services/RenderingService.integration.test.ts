import * as cheerio from "cheerio"
import { PuppeteerRenderingService } from "./RenderingService"
import { fixedClock } from "../test/FixedClock"
import {
  deferredContentPage,
  staticPage,
  startTestHttpServer,
  TestHttpServer,
} from "../test/TestHttpServer"

// These tests drive a real Chromium against a local fixture server, so they
// cover the parts of `PuppeteerRenderingService` that the mocked unit tests in
// `RenderingService.test.ts` cannot: navigation, deferred DOM updates and
// in-page script evaluation.
describe("RenderingService against a real browser", () => {
  const renderingService = new PuppeteerRenderingService(fixedClock())

  let server: TestHttpServer

  beforeAll(async () => {
    server = await startTestHttpServer({
      "/static": staticPage,
      "/deferred": deferredContentPage(500),
      "/never": deferredContentPage(60_000),
    })
  })

  afterAll(async () => {
    await server.close()
  })

  describe("render", () => {
    test("returns the rendered markup of a static page", async () => {
      const html = await renderingService.render(server.urlFor("/static"), null)

      const $ = cheerio.load(html)

      expect($("#heading").text()).toBe("Static heading")
      expect($(".paragraph").text()).toBe("Static paragraph")
    })

    test("captures content that JavaScript adds after the load event", async () => {
      const html = await renderingService.render(server.urlFor("/deferred"), [
        ".deferred",
      ])

      const $ = cheerio.load(html)

      expect($(".deferred").text()).toBe("Deferred")
    })

    test("waits for every selector in the list", async () => {
      const html = await renderingService.render(server.urlFor("/deferred"), [
        "#immediate",
        "#container",
        ".deferred",
      ])

      const $ = cheerio.load(html)

      expect($("#immediate").text()).toBe("Immediate")
      expect($(".deferred").text()).toBe("Deferred")
    })

    test("misses deferred content when no selectors are supplied", async () => {
      const html = await renderingService.render(
        server.urlFor("/deferred"),
        null
      )

      const $ = cheerio.load(html)

      expect($("#immediate").text()).toBe("Immediate")
      expect($(".deferred")).toHaveLength(0)
    })

    test("rejects when a selector does not appear before the timeout", async () => {
      const impatientRenderingService = new PuppeteerRenderingService(
        fixedClock(),
        1_000
      )

      await expect(
        impatientRenderingService.render(server.urlFor("/never"), [".deferred"])
      ).rejects.toThrow(/\.deferred/u)
    })

    test("rejects when the server responds with a connection error", async () => {
      await expect(
        renderingService.render("http://127.0.0.1:1/unreachable", null)
      ).rejects.toThrow()
    })

    test("renders a 404 response rather than rejecting", async () => {
      const html = await renderingService.render(
        server.urlFor("/missing"),
        null
      )

      expect(html).toContain("Not Found")
    })
  })

  describe("execute", () => {
    test("returns the result of the evaluated script", async () => {
      const title = await renderingService.execute(
        server.urlFor("/static"),
        "document.title",
        null
      )

      expect(title).toBe("Static")
    })

    test("evaluates the script against the deferred DOM", async () => {
      const text = await renderingService.execute(
        server.urlFor("/deferred"),
        "document.querySelector('.deferred').textContent",
        [".deferred"]
      )

      expect(text).toBe("Deferred")
    })

    test("returns structured values produced by the script", async () => {
      const result = await renderingService.execute(
        server.urlFor("/static"),
        "({ heading: document.querySelector('#heading').textContent, count: document.querySelectorAll('p').length })",
        null
      )

      expect(result).toEqual({ heading: "Static heading", count: 1 })
    })

    test("rejects when the script throws", async () => {
      await expect(
        renderingService.execute(
          server.urlFor("/static"),
          "missingFunction()",
          null
        )
      ).rejects.toThrow(/missingFunction is not defined/u)
    })
  })
})
