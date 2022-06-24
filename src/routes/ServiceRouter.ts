import express, {Request, Response} from "express"
import packageJson from "../../package.json"
import {Clock} from "../utils/Clock"
import {ServiceInformation} from "../config/ServiceInformation"

export const create = (clock: Clock, serviceInformation: ServiceInformation) => {
    const serviceRouter = express.Router()

    serviceRouter.get("/information", (request: Request, response: Response) => {
        response.status(200).json({
            name: packageJson.name,
            version: packageJson.version,
            timestamp: clock.timestamp(),
            gitBranch: serviceInformation.gitBranch,
            gitCommit: serviceInformation.gitCommit,
            buildTimestamp: serviceInformation.buildTimestamp.map(moment => moment.toISOString()).orJust("not available")
        })
    })

    return serviceRouter
}
