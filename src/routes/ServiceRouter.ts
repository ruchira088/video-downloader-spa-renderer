import express, { Request, Response, Router } from "express"
import { HealthService, HealthStatus } from "../services/HealthService"
import { Logger } from "winston"
import { create as createLogger } from "../logger/Logger"

const logger: Logger = createLogger(__filename)

export const createServiceRouter = (healthService: HealthService): Router =>
  express
    .Router()
    .get("/information", (request: Request, response: Response) => {
      response.status(200).json(healthService.serviceInformation())
    })
    .get("/health-check", async (request: Request, response: Response) => {
      const healthCheck = await healthService.healthCheck()

      const statusCode: 200 | 503 = Object.values<HealthStatus>(
        healthCheck
      ).some((healthStatus) => healthStatus === HealthStatus.Unhealthy)
        ? 503
        : 200

      if (statusCode !== 200)
        logger.warn(
          `Health check failed response=${JSON.stringify(healthCheck)}`
        )

      response.status(statusCode).json(healthCheck)
    })
