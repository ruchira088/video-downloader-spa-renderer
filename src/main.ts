import {Logger} from "winston"
import {ApplicationConfiguration, createApplicationConfiguration} from "./config/ApplicationConfiguration"
import {create as createLogger} from "./logger/Logger"
import {createAppFromConfig} from "./app"
import {Express} from "express"
import {Server} from "node:http"

const logger: Logger = createLogger(__filename)

const applicationConfiguration: ApplicationConfiguration = createApplicationConfiguration(process.env)
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