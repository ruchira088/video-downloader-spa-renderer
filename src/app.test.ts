import request from "supertest"
import config from "config"
import * as cheerio from "cheerio"
import { createApp, createAppFromConfig } from "./app"
import { HealthService, HealthStatus } from "./services/HealthService"
import { RenderingService } from "./services/RenderingService"
import { ApplicationConfiguration } from "./config/ApplicationConfiguration"
import {
  deferredContentPage,
  staticPage,
  startTestHttpServer,
  TestHttpServer,
} from "./test/TestHttpServer"
import { allowAllHosts } from "./services/HostPolicy"

describe("HTTP application", () => {
  const appConfig = ApplicationConfiguration.parse(config)

  describe("wiring", () => {
    let renderingService: jest.Mocked<RenderingService>
    let healthService: jest.Mocked<HealthService>

    const createTestApp = () => createApp(renderingService, healthService)

    beforeEach(() => {
      renderingService = {
        render: jest.fn().mockResolvedValue("<html></html>"),
        execute: jest.fn().mockResolvedValue("result"),
      }

      healthService = {
        serviceInformation: jest.fn().mockReturnValue({
          name: "test-app",
          timestamp: "2024-01-01T00:00:00.000Z",
          gitBranch: "main",
          gitCommit: "abc123",
          buildTimestamp: "2024-01-01T00:00:00.000Z",
        }),
        healthCheck: jest.fn().mockResolvedValue({
          internetConnectivity: HealthStatus.Healthy,
          spaRendering: HealthStatus.Healthy,
        }),
      }
    })

    test.each([
      ["GET", "/service/information", 200],
      ["GET", "/service/health-check", 200],
      ["POST", "/render", 200],
      ["POST", "/render/execute", 200],
    ])("mounts %s %s", async (method, path, expectedStatus) => {
      const body = { url: "https://example.com", script: "document.title" }

      const response =
        method === "GET"
          ? await request(createTestApp()).get(path)
          : await request(createTestApp()).post(path).send(body)

      expect(response.status).toBe(expectedStatus)
    })

    test.each([
      ["/unknown", "GET"],
      ["/render/unknown", "POST"],
      ["/service", "GET"],
    ])("responds with 404 for %s", async (path, method) => {
      const response =
        method === "GET"
          ? await request(createTestApp()).get(path)
          : await request(createTestApp()).post(path)

      expect(response.status).toBe(404)
      expect(response.body).toStrictEqual({
        errorMessages: [`Endpoint not found at ${path}`],
      })
    })

    test("parses JSON request bodies", async () => {
      await request(createTestApp())
        .post("/render")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ url: "https://example.com" }))

      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        undefined
      )
    })

    test("parses form encoded request bodies", async () => {
      await request(createTestApp())
        .post("/render")
        .type("form")
        .send({ url: "https://example.com" })

      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        undefined
      )
    })

    test("returns request body validation error messages", async () => {
      const response = await request(createTestApp())
        .post("/render")
        .send({ readyCssSelectors: ["#app"] })

      expect(renderingService.render).not.toHaveBeenCalled()
      expect(response.status).toBe(400)
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

    // body-parser raises an `entity.parse.failed` error carrying a 400, which
    // the error handler honours rather than reporting a server failure.
    test("returns 400 for a malformed JSON body", async () => {
      const response = await request(createTestApp())
        .post("/render")
        .set("Content-Type", "application/json")
        .send("{ not json")

      expect(response.status).toBe(400)
      expect(response.body.errorMessages).toHaveLength(1)
      expect(renderingService.render).not.toHaveBeenCalled()
    })

    test("returns 413 when the request body is too large", async () => {
      const response = await request(createTestApp())
        .post("/render")
        .set("Content-Type", "application/json")
        .send(
          JSON.stringify({
            url: "https://example.com",
            padding: "x".repeat(200_000),
          })
        )

      expect(response.status).toBe(413)
      expect(response.body.errorMessages).toHaveLength(1)
    })

    test("surfaces unexpected service failures as 500", async () => {
      healthService.healthCheck.mockRejectedValue(new Error("Boom"))

      const response = await request(createTestApp()).get(
        "/service/health-check"
      )

      expect(response.status).toBe(500)
      expect(response.body).toStrictEqual({ errorMessages: ["Boom"] })
    })
  })

  describe("against a locally served SPA", () => {
    let server: TestHttpServer
    let app: ReturnType<typeof createAppFromConfig>

    beforeAll(async () => {
      server = await startTestHttpServer({
        "/": deferredContentPage(300),
        "/static": staticPage,
      })

      app = createAppFromConfig(
        {
          ...appConfig,
          healthCheckConfiguration: {
            url: server.url,
            readyCssSelectors: ["#immediate", ".deferred"],
          },
        },
        allowAllHosts
      )
    })

    afterAll(async () => {
      await server.close()
    })

    test("refuses to render a local address by default", async () => {
      const response = await request(createAppFromConfig(appConfig))
        .post("/render")
        .send({ url: server.urlFor("/static") })

      expect(response.status).toBe(400)
      expect(response.body).toStrictEqual({
        errorMessages: ["Blocked host: 127.0.0.1"],
      })
    })

    test("renders a page including its deferred content", async () => {
      const response = await request(app)
        .post("/render")
        .send({ url: server.url, readyCssSelectors: [".deferred"] })

      expect(response.status).toBe(200)

      const $ = cheerio.load(response.text)
      expect($("#immediate").text()).toBe("Immediate")
      expect($(".deferred").text()).toBe("Deferred")
    })

    test("executes a script against the rendered page", async () => {
      const response = await request(app)
        .post("/render/execute")
        .send({
          url: server.urlFor("/static"),
          script: "document.querySelector('#heading').textContent",
        })

      expect(response.status).toBe(200)
      expect(response.text).toBe("Static heading")
    })

    test("responds with 400 when the page cannot be rendered", async () => {
      const response = await request(app)
        .post("/render")
        .send({ url: "file:///etc/passwd" })

      expect(response.status).toBe(400)
      expect(response.body.errorMessages).toEqual([
        "Invalid URL protocol: file:. Only http and https are allowed.",
      ])
    })

    test("reports the service as healthy", async () => {
      const response = await request(app).get("/service/health-check")

      expect(response.status).toBe(200)
      expect(response.body).toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Healthy,
      })
    })

    test("reports the build information from the configuration", async () => {
      const response = await request(app).get("/service/information")

      expect(response.status).toBe(200)
      expect(response.body.gitBranch).toBe(appConfig.buildInformation.gitBranch)
      expect(response.body.gitCommit).toBe(appConfig.buildInformation.gitCommit)
      expect(response.body.name).toBe("video-downloader-spa-renderer")
    })
  })

  describe("when the health check target is unreachable", () => {
    test("reports the service as unhealthy", async () => {
      const app = createAppFromConfig({
        ...appConfig,
        healthCheckConfiguration: {
          url: "http://127.0.0.1:1",
          readyCssSelectors: ["#never"],
        },
      })

      const response = await request(app).get("/service/health-check")

      expect(response.status).toBe(503)
      expect(response.body).toStrictEqual({
        internetConnectivity: HealthStatus.Unhealthy,
        spaRendering: HealthStatus.Unhealthy,
      })
    })
  })
})
