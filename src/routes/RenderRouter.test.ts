import request from "supertest"
import express, { Express } from "express"
import { createRenderRouter } from "./RenderRouter"
import errorHandler from "../middleware/ErrorHandler"
import { RenderingError, RenderingService } from "../services/RenderingService"

describe("RenderRouter", () => {
  let renderingService: jest.Mocked<RenderingService>
  let app: Express

  beforeEach(() => {
    renderingService = {
      render: jest.fn().mockResolvedValue("<html><body>Hello</body></html>"),
      execute: jest.fn().mockResolvedValue("Page title"),
    }

    app = express()
      .use(express.json())
      .use("/render", createRenderRouter(renderingService))
      .use(errorHandler)
  })

  describe("POST /render", () => {
    test("responds with the rendered markup", async () => {
      const response = await request(app)
        .post("/render")
        .send({ url: "https://example.com", readyCssSelectors: ["#app"] })

      expect(response.status).toBe(200)
      expect(response.text).toBe("<html><body>Hello</body></html>")
      expect(response.headers["content-type"]).toMatch(/text\/html/u)
      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        ["#app"]
      )
    })

    test("passes undefined through when readyCssSelectors is omitted", async () => {
      const response = await request(app)
        .post("/render")
        .send({ url: "https://example.com" })

      expect(response.status).toBe(200)
      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        undefined
      )
    })

    test("passes null through when readyCssSelectors is null", async () => {
      const response = await request(app)
        .post("/render")
        .send({ url: "https://example.com", readyCssSelectors: null })

      expect(response.status).toBe(200)
      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        null
      )
    })

    test("ignores properties that are not part of the contract", async () => {
      const response = await request(app)
        .post("/render")
        .send({ url: "https://example.com", unexpected: "value" })

      expect(response.status).toBe(200)
      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        undefined
      )
    })

    test("responds with 400 when the request cannot be rendered", async () => {
      renderingService.render.mockRejectedValue(
        new RenderingError("Navigation timeout of 30000 ms exceeded")
      )

      const response = await request(app)
        .post("/render")
        .send({ url: "https://example.com" })

      expect(response.status).toBe(400)
      expect(response.body).toStrictEqual({
        errorMessages: ["Navigation timeout of 30000 ms exceeded"],
      })
    })

    test("responds with 400 when the URL is rejected", async () => {
      renderingService.render.mockRejectedValue(
        new RenderingError("Invalid URL protocol: file:")
      )

      const response = await request(app)
        .post("/render")
        .send({ url: "file:///etc/passwd" })

      expect(response.status).toBe(400)
      expect(response.body).toStrictEqual({
        errorMessages: ["Invalid URL protocol: file:"],
      })
    })

    // A failure of the renderer itself, rather than of the request.
    test("responds with 500 when the renderer fails unexpectedly", async () => {
      renderingService.render.mockRejectedValue(
        new Error("Failed to launch the browser process")
      )

      const response = await request(app)
        .post("/render")
        .send({ url: "https://example.com" })

      expect(response.status).toBe(500)
      expect(response.body).toStrictEqual({
        errorMessages: ["Failed to launch the browser process"],
      })
    })

    test.each([
      ["the body is empty", {}],
      ["url is missing", { readyCssSelectors: ["#app"] }],
      ["url is not a string", { url: 42 }],
      [
        "readyCssSelectors is not an array of strings",
        { url: "https://example.com", readyCssSelectors: [1, 2] },
      ],
      [
        "readyCssSelectors is not an array",
        { url: "https://example.com", readyCssSelectors: "#app" },
      ],
    ])("responds with 400 when %s", async (_description, body) => {
      const response = await request(app).post("/render").send(body)

      expect(response.status).toBe(400)
      expect(Array.isArray(response.body.errorMessages)).toBe(true)
      expect(response.body.errorMessages.length).toBeGreaterThan(0)
      expect(renderingService.render).not.toHaveBeenCalled()
    })

    test("reports the offending field in the validation error", async () => {
      const response = await request(app)
        .post("/render")
        .send({ readyCssSelectors: ["#app"] })

      expect(response.body).toStrictEqual({
        errorMessages: [
          {
            code: "invalid_type",
            expected: "string",
            message: "Invalid input: expected string, received undefined",
            path: ["url"],
          },
        ],
      })
    })
  })

  describe("POST /render/execute", () => {
    test("responds with the result of the executed script", async () => {
      const response = await request(app)
        .post("/render/execute")
        .send({
          url: "https://example.com",
          script: "document.title",
          readyCssSelectors: ["#app"],
        })

      expect(response.status).toBe(200)
      expect(response.text).toBe("Page title")
      expect(renderingService.execute).toHaveBeenCalledWith(
        "https://example.com",
        "document.title",
        ["#app"]
      )
    })

    test("serialises structured results as JSON", async () => {
      renderingService.execute.mockResolvedValue({
        title: "Page title",
        links: 3,
      } as unknown as string)

      const response = await request(app)
        .post("/render/execute")
        .send({ url: "https://example.com", script: "collect()" })

      expect(response.status).toBe(200)
      expect(response.body).toStrictEqual({ title: "Page title", links: 3 })
    })

    test("responds with 400 when the script fails", async () => {
      renderingService.execute.mockRejectedValue(
        new RenderingError("foo is not defined")
      )

      const response = await request(app)
        .post("/render/execute")
        .send({ url: "https://example.com", script: "foo()" })

      expect(response.status).toBe(400)
      expect(response.body).toStrictEqual({
        errorMessages: ["foo is not defined"],
      })
    })

    test.each([
      ["script is missing", { url: "https://example.com" }],
      ["url is missing", { script: "document.title" }],
      ["script is not a string", { url: "https://example.com", script: 42 }],
    ])("responds with 400 when %s", async (_description, body) => {
      const response = await request(app).post("/render/execute").send(body)

      expect(response.status).toBe(400)
      expect(Array.isArray(response.body.errorMessages)).toBe(true)
      expect(renderingService.execute).not.toHaveBeenCalled()
    })

    test("does not fall through to the render handler", async () => {
      await request(app)
        .post("/render/execute")
        .send({ url: "https://example.com", script: "document.title" })

      expect(renderingService.render).not.toHaveBeenCalled()
    })
  })
})
