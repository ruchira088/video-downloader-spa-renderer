import express from "express"
import {ApplicationConfiguration, applicationConfiguration} from "./ApplicationConfiguration"
import serviceRouter from "./routes/ServiceRouter"
import * as RenderRouter from "./routes/RenderRouter"

const run = async (configuration: ApplicationConfiguration) => {
    const app = express()

    app.use(express.json())
    app.use(express.urlencoded({extended: false}))

    const renderRouter = await RenderRouter.create()

    app.use("/service", serviceRouter)
    app.use("/render", renderRouter)

    app.listen(configuration.port, configuration.host, () => {
        console.log(`Server started at http://${configuration.host}:${configuration.port}`)
    })
}

run(applicationConfiguration(process.env))