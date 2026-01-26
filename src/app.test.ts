import request from "supertest"
import config from "config"
import { HealthService } from "./services/HealthService"
import * as cheerio from "cheerio"
import { createApp, createAppFromConfig } from "./app"
import { RenderingService } from "./services/RenderingService"
import { ApplicationConfiguration } from "./config/ApplicationConfiguration"

describe("Testing HTTP application", () => {
  const appConfig = ApplicationConfiguration.parse(config)
  const healthCheckUrl = appConfig.healthCheckConfiguration.url
  const healthCheckSelectors =
    appConfig.healthCheckConfiguration.readyCssSelectors

  test("Retrieving the HTML markup of the health check SPA service", async () => {
    const app = createAppFromConfig(appConfig)

    const response = await request(app).post("/render").send({
      url: healthCheckUrl,
      readyCssSelectors: healthCheckSelectors,
    })

    expect(response.status).toBe(200)

    const $: cheerio.CheerioAPI = cheerio.load(response.text)

    expect($("#text-field").text()).toBe("ID specified")
    expect($(".class-name").text()).toBe("Class specified")
    expect($(".deferred-class-name").text()).toBe("Hello World")
    expect($("#build-timestamp")).toBeTruthy()
  })

  test("Returns request body validation error messages", async () => {
    const renderingService = {} as jest.Mocked<RenderingService>
    renderingService.render = jest.fn()

    const healthService = {} as jest.Mocked<HealthService>

    const app = createApp(renderingService, healthService)

    const response = await request(app)
      .post("/render")
      .send({ readyCssSelectors: healthCheckSelectors })

    expect(renderingService.render).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
    expect(response.body).toStrictEqual({
      errorMessage: [
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
