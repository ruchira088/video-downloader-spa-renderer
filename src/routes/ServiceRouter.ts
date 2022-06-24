import express, {Request, Response} from "express"
import packageJson from "../../package.json"
import {TimeService} from "../services/TimeService"
import {ServiceInformation} from "../config/ServiceInformation"

export const create = (timeService: TimeService, serviceInformation: ServiceInformation) => {
    const serviceRouter = express.Router()

    serviceRouter.get("/information", (request: Request, response: Response) => {
        response.status(200).json({
            name: packageJson.name,
            version: packageJson.version,
            timestamp: timeService.timestamp(),
            gitBranch: serviceInformation.gitBranch,
            gitCommit: serviceInformation.gitCommit,
            buildTimestamp: serviceInformation.buildTimestamp.map(moment => moment.toISOString()).orJust("not available")
        })
    })

    return serviceRouter
}
