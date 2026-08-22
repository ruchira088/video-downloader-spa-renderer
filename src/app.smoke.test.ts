import request from "supertest"
import config from "config"
import * as cheerio from "cheerio"
import { createAppFromConfig } from "./app"
import { ApplicationConfiguration } from "./config/ApplicationConfiguration"

// The only test that leaves the machine. It guards the coupling between
// `healthCheckConfiguration` and the deployed health-check SPA, so it is kept
// apart from the hermetic suite and retried to absorb transient network
// failures.
jest.retryTimes(2, { logErrorsBeforeRetry: true })

describe("Smoke test against the deployed health check SPA", () => {
  const appConfig = ApplicationConfiguration.parse(config)

  test("renders the markup the health check configuration waits for", async () => {
    const app = createAppFromConfig(appConfig)

    const response = await request(app).post("/render").send({
      url: appConfig.healthCheckConfiguration.url,
      readyCssSelectors: appConfig.healthCheckConfiguration.readyCssSelectors,
    })

    expect(response.status).toBe(200)

    const $: cheerio.CheerioAPI = cheerio.load(response.text)

    expect($("#text-field").text()).toBe("ID specified")
    expect($(".class-name").text()).toBe("Class specified")
    expect($(".deferred-class-name").text()).toBe("Hello World")
    expect($("#build-timestamp")).toBeTruthy()
  })

  test("reports the deployed SPA as healthy", async () => {
    const app = createAppFromConfig(appConfig)

    const response = await request(app).get("/service/health-check")

    expect(response.status).toBe(200)
    expect(response.body).toStrictEqual({
      internetConnectivity: "healthy",
      spaRendering: "healthy",
    })
  })
})
