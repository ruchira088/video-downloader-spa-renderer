import express, {Express} from "express"
import {PuppeteerRenderingService, RenderingService} from "./services/RenderingService"
import {HealthServiceImpl} from "./services/HealthService"
import {createServiceRouter} from "./routes/ServiceRouter"
import {createRenderRouter} from "./routes/RenderRouter"
import notFoundHandler from "./middleware/NotFoundHandler"
import errorHandler from "./middleware/ErrorHandler"
import {ApplicationConfiguration} from "./config/ApplicationConfiguration";
import axios, {AxiosInstance} from "axios";
import {defaultClock} from "./utils/Clock";
import packageJson from "../package.json";

const createApp =
    (renderingService: RenderingService, healthService: HealthServiceImpl): Express => {
        const app: Express = express()

        app.use(express.json())
        app.use(express.urlencoded({extended: false}))

        app.use("/service", createServiceRouter(healthService))
        app.use("/render", createRenderRouter(renderingService))

        app.use(notFoundHandler)
        app.use(errorHandler)

        return app
    }

export const createExpressApp =
    (applicationConfiguration: ApplicationConfiguration): Express => {
        const axiosInstance: AxiosInstance = axios.create({timeout: 10_000})
        const renderingService: RenderingService = new PuppeteerRenderingService(defaultClock)

        const healthService = new HealthServiceImpl(
            renderingService,
            axiosInstance,
            packageJson,
            applicationConfiguration.buildInformation,
            defaultClock
        )

        const expressApp: Express = createApp(renderingService, healthService)

        return expressApp
    }