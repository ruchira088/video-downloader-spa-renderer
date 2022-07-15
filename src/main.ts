import {applicationConfiguration} from "./config/ApplicationConfiguration"
import {defaultClock} from "./utils/Clock"
import * as Logger from "./logger/Logger"
import {httpApplication} from "./app"

const logger = Logger.create(__filename)

const configuration = applicationConfiguration(process.env)

httpApplication(defaultClock, configuration)
    .then(app => {
        const {host, port} = configuration.httpConfiguration

        app.listen(port, host, () => {
            logger.info(`Server started at http://${host}:${port}`)
        })
    })
    .catch(error => logger.error(error))