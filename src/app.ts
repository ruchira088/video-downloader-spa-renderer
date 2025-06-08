import express, {Express} from "express"
import {ApplicationConfiguration} from "./config/ApplicationConfiguration"
import {createServiceRouter} from "./routes/ServiceRouter"
import {createRenderRouter} from "./routes/RenderRouter"
import {createRenderingService, RenderingService} from "./services/RenderingService"
import {HealthServiceImpl, PackageJson} from "./services/HealthService"
import notFoundHandler from "./middleware/NotFoundHandler"
import errorHandler from "./middleware/ErrorHandler"
import {Clock} from "./utils/Clock"
import {Browser} from "puppeteer"
import axios from "axios";

export const createHttpApplication =
    async (browser: Browser, clock: Clock, applicationConfiguration: ApplicationConfiguration, packageJson: PackageJson): Promise<Express> => {
        const axiosInstance = axios.create({timeout: 10_000})
        const renderingService: RenderingService = await createRenderingService(browser, clock)
        const healthService = new HealthServiceImpl(
            renderingService,
            axiosInstance,
            packageJson,
            applicationConfiguration.buildInformation,
            clock
        )

        const app = express()

        app.use(express.json())
        app.use(express.urlencoded({extended: false}))

        app.use("/service", createServiceRouter(healthService))
        app.use("/render", createRenderRouter(renderingService))

        app.use(notFoundHandler)
        app.use(errorHandler)

        return app
    }