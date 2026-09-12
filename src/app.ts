import express, { Express } from "express"
import {
  PuppeteerRenderingService,
  RenderingService,
} from "./services/RenderingService"
import { createServiceRouter } from "./routes/ServiceRouter"
import { createRenderRouter } from "./routes/RenderRouter"
import notFoundHandler from "./middleware/NotFoundHandler"
import errorHandler from "./middleware/ErrorHandler"
import { ApplicationConfiguration } from "./config/ApplicationConfiguration"
import axios, { AxiosInstance } from "axios"
import { defaultClock } from "./utils/Clock"
import packageJson from "../package.json"
import { HealthService, HealthServiceImpl } from "./services/HealthService"
import { HostPolicy, publicHostsOnly } from "./services/HostPolicy"

export const createApp = (
  renderingService: RenderingService,
  healthService: HealthService
): Express => {
  const app: Express = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))

  app.use("/service", createServiceRouter(healthService))
  app.use("/render", createRenderRouter(renderingService))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * Only public hosts may be rendered unless a `hostPolicy` says otherwise,
 * which the tests do to render fixtures served from the loopback address.
 */
export const createAppFromConfig = (
  applicationConfiguration: ApplicationConfiguration,
  hostPolicy: HostPolicy = publicHostsOnly()
): Express => {
  const axiosInstance: AxiosInstance = axios.create({ timeout: 10_000 })
  const renderingService: RenderingService = new PuppeteerRenderingService(
    defaultClock,
    hostPolicy
  )

  const healthService = new HealthServiceImpl(
    renderingService,
    axiosInstance,
    packageJson,
    applicationConfiguration.buildInformation,
    applicationConfiguration.healthCheckConfiguration,
    defaultClock
  )

  const expressApp: Express = createApp(renderingService, healthService)

  return expressApp
}
