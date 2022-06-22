import express, {Request, Response} from "express"
import moment from "moment"
import packageJson from "../../package.json"

const serviceRouter = express.Router()

serviceRouter.get("/health-check", (request: Request, response: Response) => {
    const timestamp = moment()

    response.status(200).json({
        name: packageJson.name,
        version: packageJson.version,
        timestamp
    })
})

export default serviceRouter