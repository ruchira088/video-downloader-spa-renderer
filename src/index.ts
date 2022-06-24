import express from "express"
import {ApplicationConfiguration, applicationConfiguration} from "./config/ApplicationConfiguration"
import * as ServiceRouter from "./routes/ServiceRouter"
import * as RenderRouter from "./routes/RenderRouter"
import errorHandler from "./middleware/ErrorHandler"
import {TimeService, timeServiceImpl} from "./services/TimeService"

const run = async (timeService: TimeService, applicationConfiguration: ApplicationConfiguration) => {
    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({extended: false}))

    app.use("/service", ServiceRouter.create(timeService,applicationConfiguration.serviceInformation))
    app.use("/render", await RenderRouter.create())

    app.use(errorHandler)

    const { host, port } = applicationConfiguration.httpConfiguration

    app.listen(port, host, () => {
        console.log(`Server started at http://${host}:${port}`)
    })
}

run(timeServiceImpl, applicationConfiguration(process.env))