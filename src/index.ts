import express from "express"
import {ApplicationConfiguration, applicationConfiguration} from "./config/ApplicationConfiguration"
import * as ServiceRouter from "./routes/ServiceRouter"
import * as RenderRouter from "./routes/RenderRouter"
import notFoundHandler from "./middleware/NotFoundHandler"
import {Clock, defaultClock} from "./utils/Clock"

const run = async (clock: Clock, applicationConfiguration: ApplicationConfiguration) => {
    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({extended: false}))

    app.use("/service", ServiceRouter.create(clock, applicationConfiguration.serviceInformation))
    app.use("/render", await RenderRouter.create(clock))

    app.use(notFoundHandler)

    const {host, port} = applicationConfiguration.httpConfiguration

    app.listen(port, host, () => {
        console.log(`Server started at http://${host}:${port}`)
    })
}

run(defaultClock, applicationConfiguration(process.env))