import express, {Express} from "express"
import {ApplicationConfiguration} from "./config/ApplicationConfiguration"
import * as ServiceRouter from "./routes/ServiceRouter"
import * as RenderRouter from "./routes/RenderRouter"
import * as RenderingService from "./services/RenderingService"
import * as HealthService from "./services/HealthService"
import notFoundHandler from "./middleware/NotFoundHandler"
import errorHandler from "./middleware/ErrorHandler"
import {Clock} from "./utils/Clock"
import {Browser} from "puppeteer"

export const httpApplication = async (browser: Browser, clock: Clock, applicationConfiguration: ApplicationConfiguration): Promise<Express> => {
    const renderingService = await RenderingService.create(browser, clock)
    const healthService = HealthService.create(renderingService, applicationConfiguration.serviceInformation, clock)

    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({extended: false}))

    app.use("/service", ServiceRouter.create(healthService))
    app.use("/render", RenderRouter.create(renderingService))

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app
}