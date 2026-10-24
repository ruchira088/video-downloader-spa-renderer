import request from "supertest"
import config from "config"
import { createAppFromConfig } from "./app"
import { ApplicationConfiguration } from "./config/ApplicationConfiguration"
import {
  deferredContentPage,
  startTestHttpServer,
  TestHttpServer,
} from "./test/TestHttpServer"
import { allowAllHosts } from "./services/HostPolicy"

// Drives the concurrency limit and render deadline end to end, through the
// configuration that `createAppFromConfig` wires into the renderer.
describe("HTTP application with a renderer limited to a single browser", () => {
  const appConfig = ApplicationConfiguration.parse(config)

  let server: TestHttpServer

  beforeAll(async () => {
    server = await startTestHttpServer({
      "/never": deferredContentPage(60_000),
    })
  })

  afterAll(async () => {
    await server.close()
  })

  test("sheds a render that finds the browser busy, and bounds the one that holds it", async () => {
    const app = createAppFromConfig(
      {
        ...appConfig,
        renderingConfiguration: {
          renderTimeoutMs: 2_000,
          maxConcurrentRenders: 1,
          maxQueuedRenders: 0,
        },
      },
      allowAllHosts
    )
    const renderNever = () =>
      request(app)
        .post("/render")
        .send({
          url: server.urlFor("/never"),
          readyCssSelectors: [".deferred"],
        })

    const responses = await Promise.all([renderNever(), renderNever()])

    const busy = responses.find(({ status }) => status === 503)
    const timedOut = responses.find(({ status }) => status === 400)

    expect(busy?.headers["retry-after"]).toBe("5")
    expect(timedOut?.body).toStrictEqual({
      errorMessages: ["Render did not complete within 2000ms"],
    })
  })
})
