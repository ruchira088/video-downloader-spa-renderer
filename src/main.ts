import {Browser} from "puppeteer"
import {Express} from "express"
import {Logger} from "winston"
import {ApplicationConfiguration, createApplicationConfiguration} from "./config/ApplicationConfiguration"
import {defaultClock} from "./utils/Clock"
import {create as createLogger} from "./logger/Logger"
import {createHttpApplication} from "./app"
import {launchBrowser} from "./services/RenderingService"

const logger: Logger = createLogger(__filename)

const main = async (applicationConfiguration: ApplicationConfiguration): Promise<void> => {
    try {
        const browser: Browser = await launchBrowser()
        const app: Express = await createHttpApplication(browser, defaultClock, applicationConfiguration)
        const {host, port} = applicationConfiguration.httpConfiguration

        app.listen(port, host, () => {
            logger.info(`Server started at http://${host}:${port}`)
        })
    } catch (error) {
        logger.error(error)
    }
}

const configuration = createApplicationConfiguration(process.env)

main(configuration)