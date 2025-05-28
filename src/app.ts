import express, {Express} from "express"
import {ApplicationConfiguration} from "./config/ApplicationConfiguration"
import {createServiceRouter} from "./routes/ServiceRouter"
import {createRenderRouter} from "./routes/RenderRouter"
import {createRenderingService, RenderingService} from "./services/RenderingService"
import {createHealthService, HealthService} from "./services/HealthService"
import notFoundHandler from "./middleware/NotFoundHandler"
import errorHandler from "./middleware/ErrorHandler"
import {Clock} from "./utils/Clock"
import {Browser} from "puppeteer"

export const createHttpApplication =
    async (browser: Browser, clock: Clock, applicationConfiguration: ApplicationConfiguration): Promise<Express> => {
        const renderingService: RenderingService = await createRenderingService(browser, clock)
        const healthService: HealthService = createHealthService(renderingService, applicationConfiguration.serviceInformation, clock)

        const app = express()

        app.use(express.json())
        app.use(express.urlencoded({extended: false}))

        app.use("/service", createServiceRouter(healthService))
        app.use("/render", createRenderRouter(renderingService))

        app.use(notFoundHandler)
        app.use(errorHandler)

        return app
    }