import {Logger} from "winston"
import {Express} from "express"
import config from "config"
import {Server} from "node:http"

import {create as createLogger} from "./logger/Logger"
import {createAppFromConfig} from "./app"
import {ApplicationConfiguration} from "./config/ApplicationConfiguration";

const logger: Logger = createLogger(__filename)

const applicationConfiguration: ApplicationConfiguration = ApplicationConfiguration.parse(config)
const expressApp: Express = createAppFromConfig(applicationConfiguration)

const {host, port} = applicationConfiguration.httpConfiguration

const server: Server = expressApp.listen(port, host, () => {
    logger.info(`Server started at http://${host}:${port}`)
})

process.on("SIGTERM", () => {
    logger.info("Received SIGTERM signal. Shutting down server...")

    server.close(() => {
        logger.info("Server stopped")
    })
})
