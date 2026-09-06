import { AxiosInstance } from "axios"
import { create as createLogger } from "../logger/Logger"
import { Logger } from "winston"
import { BuildInformation } from "../config/BuildInformation"
import { HealthCheckConfiguration } from "../config/HealthCheckConfiguration"
import { Clock } from "../utils/Clock"
import { RenderingService } from "./RenderingService"
import { errorMessage, withTimeout } from "../utils/Helpers"

export type ApplicationInformation = {
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

const INTERNET_CONNECTIVITY_TIMEOUT_MS = 5_000
const SPA_RENDERING_TIMEOUT_MS = 10_000

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
    const { url, readyCssSelectors } = this.healthCheckConfiguration

    // Both checks run concurrently, so the whole health check is bounded by
    // the longer of the two timeouts rather than by their sum.
    const [internetConnectivity, spaRendering] = await Promise.all([
      this.status(
        "Internet connectivity",
        INTERNET_CONNECTIVITY_TIMEOUT_MS,
        this.axiosInstance.get(url).then((response) => {
          if (response.status !== 200) {
            throw new Error(`Unexpected HTTP status ${response.status}`)
          }
        })
      ),
      this.status(
        "SPA rendering",
        SPA_RENDERING_TIMEOUT_MS,
        this.renderingService.render(url, readyCssSelectors)
      ),
    ])

    return { internetConnectivity, spaRendering }
  }

  private async status(
    description: string,
    timeoutMs: number,
    check: Promise<unknown>
  ): Promise<HealthStatus> {
    try {
      await withTimeout(check, timeoutMs)
      return HealthStatus.Healthy
    } catch (exception) {
      logger.error(
        `Health check failed for ${description} url=${this.healthCheckConfiguration.url} error=${errorMessage(exception)}`
      )
      return HealthStatus.Unhealthy
    }
  }
}
