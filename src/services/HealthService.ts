import { AxiosInstance } from "axios"
import { create as createLogger } from "../logger/Logger"
import { Logger } from "winston"
import { BuildInformation } from "../config/BuildInformation"
import { HealthCheckConfiguration } from "../config/HealthCheckConfiguration"
import { Clock } from "../utils/Clock"
import { RenderingService } from "./RenderingService"
import { withTimeout } from "../utils/Helpers"

type ApplicationInformation = {
  readonly name: string
  readonly timestamp: string
  readonly gitBranch: string
  readonly gitCommit: string
  readonly buildTimestamp: string
}

export enum HealthStatus {
  Healthy = "healthy",
  Unhealthy = "unhealthy",
}

export type HealthCheck = {
  readonly internetConnectivity: HealthStatus
  readonly spaRendering: HealthStatus
}

export type PackageJson = {
  readonly name: string
}

export interface HealthService {
  serviceInformation(): ApplicationInformation

  healthCheck(): Promise<HealthCheck>
}

const logger: Logger = createLogger(__filename)

export class HealthServiceImpl implements HealthService {
  constructor(
    private readonly renderingService: RenderingService,
    private readonly axiosInstance: AxiosInstance,
    private readonly packageJson: PackageJson,
    private readonly buildInformation: BuildInformation,
    private readonly healthCheckConfiguration: HealthCheckConfiguration,
    private readonly clock: Clock
  ) {}

  serviceInformation(): ApplicationInformation {
    return {
      name: this.packageJson.name,
      timestamp: this.clock.timestamp().toISOString(),
      gitBranch: this.buildInformation.gitBranch,
      gitCommit: this.buildInformation.gitCommit,
      buildTimestamp:
        this.buildInformation.buildTimestamp?.toISOString() ?? "Unknown",
    }
  }

  async healthCheck(): Promise<HealthCheck> {
    const healthCheckUrl = this.healthCheckConfiguration.url
    const readyCssSelectors = this.healthCheckConfiguration.readyCssSelectors

    const internetConnectivity: Promise<HealthStatus> = this.axiosInstance
      .get(healthCheckUrl)
      .then<HealthStatus>((response) =>
        response.status === 200 ? HealthStatus.Healthy : HealthStatus.Unhealthy
      )
      .catch((exception) => {
        logger.error(
          `Health check failed for Internet connectivity url=${healthCheckUrl}`,
          exception.message
        )
        return HealthStatus.Unhealthy
      })

    const spaRendering: Promise<HealthStatus> = this.renderingService
      .render(healthCheckUrl, readyCssSelectors)
      .then<HealthStatus>(() => HealthStatus.Healthy)
      .catch((exception) => {
        logger.error(
          `Health check failed for SPA rendering url=${healthCheckUrl}`,
          exception.message
        )
        return HealthStatus.Unhealthy
      })

    return {
      internetConnectivity: await withTimeout(
        internetConnectivity,
        5_000,
        HealthStatus.Unhealthy
      ),
      spaRendering: await withTimeout(
        spaRendering,
        10_000,
        HealthStatus.Unhealthy
      ),
    }
  }
}
