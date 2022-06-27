import axios from "axios"
import {BuildInformation} from "../config/BuildInformation"
import {Clock} from "../utils/Clock"
import {RenderingService} from "./RenderingService"
import packageJson from "../../package.json"
import * as Logger from "../logger/Logger"

interface ApplicationInformation {
    readonly name: string
    readonly version: string
    readonly timestamp: string
    readonly gitBranch: string
    readonly gitCommit: string
    readonly buildTimestamp: string
}

type HealthStatus = "healthy" | "unhealthy"

export interface HealthService {
    serviceInformation(): ApplicationInformation

    healthCheck(): Promise<HealthCheck>
}

export interface HealthCheck {
    readonly internetConnectivity: HealthStatus
    readonly spaRendering: HealthStatus
}

const logger = Logger.create(__filename)
const client = axios.create({timeout: 5000})

const INTERNET_CONNECTIVITY_URL = "https://ip.ruchij.com"

const HEALTH_CHECK_URL = ""
const HEALTH_CHECK_READY_CSS_SELECTORS = [""]

export const create =
    (renderingService: RenderingService, buildInformation: BuildInformation, clock: Clock): HealthService => ({
        serviceInformation(): ApplicationInformation {
            return {
                name: packageJson.name,
                version: packageJson.version,
                timestamp: clock.timestamp().toISOString(),
                gitBranch: buildInformation.gitBranch,
                gitCommit: buildInformation.gitCommit,
                buildTimestamp: buildInformation.buildTimestamp.map(moment => moment.toISOString()).orJust("not available")
            }
        },
        async healthCheck(): Promise<HealthCheck> {
            const internetConnectivity: Promise<HealthStatus> =
                client.get(INTERNET_CONNECTIVITY_URL)
                    .then<HealthStatus>(response => response.status === 200 ? "healthy" : "unhealthy")
                    .catch(exception => {
                        logger.error(`Health check failed for Internet connectivity url=${INTERNET_CONNECTIVITY_URL}`, exception.message)
                        return "unhealthy"
                    })

            const spaRendering: Promise<HealthStatus> = renderingService.render(HEALTH_CHECK_URL, HEALTH_CHECK_READY_CSS_SELECTORS)
                .then<HealthStatus>(() => "healthy")
                .catch(exception => {
                    logger.error(`Health check failed for SPA rendering url=${HEALTH_CHECK_URL}`, exception.message)
                    return "unhealthy"
                })

            return {
                internetConnectivity: await internetConnectivity,
                spaRendering: await spaRendering
            }
        }
    })