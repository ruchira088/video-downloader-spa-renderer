import { Logger } from "winston"
import { Express } from "express"
import config from "config"
import { Server } from "node:http"

import { create as createLogger } from "./logger/Logger"
import { createAppFromConfig } from "./app"
import { ApplicationConfiguration } from "./config/ApplicationConfiguration"
import { gracefulShutdown } from "./utils/Shutdown"

// Kubernetes waits 30s after SIGTERM before killing the container; exit with
// an error before then rather than be killed silently.
const SHUTDOWN_GRACE_PERIOD_MS = 25_000

const logger: Logger = createLogger(__filename)

const applicationConfiguration: ApplicationConfiguration =
  ApplicationConfiguration.parse(config)
const expressApp: Express = createAppFromConfig(applicationConfiguration)

const { host, port } = applicationConfiguration.httpConfiguration

const server: Server = expressApp.listen(port, host, () => {
  logger.info(`Server started at http://${host}:${port}`)
})

const shutdown = gracefulShutdown(server, SHUTDOWN_GRACE_PERIOD_MS, (code) =>
  process.exit(code)
)

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info(`Received ${signal} signal`)
    shutdown()
  })
}
