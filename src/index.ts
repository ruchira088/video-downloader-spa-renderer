import express from "express"
import {ApplicationConfiguration, applicationConfiguration} from "./config/ApplicationConfiguration"
import * as ServiceRouter from "./routes/ServiceRouter"
import * as RenderRouter from "./routes/RenderRouter"
import * as RenderingService from "./services/RenderingService"
import * as HealthService from "./services/HealthService"
import notFoundHandler from "./middleware/NotFoundHandler"
import errorHandler from "./middleware/ErrorHandler"
import {Clock, defaultClock} from "./utils/Clock"
import * as Logger from "./logger/Logger"

const logger = Logger.create(__filename)

const run = async (clock: Clock, applicationConfiguration: ApplicationConfiguration) => {
    const renderingService = await RenderingService.create(clock)
    const healthService = HealthService.create(renderingService, applicationConfiguration.serviceInformation, clock)

    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({extended: false}))

    app.use("/service", ServiceRouter.create(healthService))
    app.use("/render", RenderRouter.create(renderingService))

    app.use(notFoundHandler)
    app.use(errorHandler)

    const {host, port} = applicationConfiguration.httpConfiguration

    app.listen(port, host, () => {
        logger.info(`Server started at http://${host}:${port}`)
    })
}

run(defaultClock, applicationConfiguration(process.env))