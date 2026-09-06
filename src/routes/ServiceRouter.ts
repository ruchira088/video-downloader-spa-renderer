import express, { Request, Response, Router } from "express"
import { HealthService, HealthStatus } from "../services/HealthService"
import { Logger } from "winston"
import { create as createLogger } from "../logger/Logger"

const logger: Logger = createLogger(__filename)

export const createServiceRouter = (healthService: HealthService): Router =>
  express
    .Router()
    .get("/information", (request: Request, response: Response) => {
      response.json(healthService.serviceInformation())
    })
    .get("/health-check", async (request: Request, response: Response) => {
      const healthCheck = await healthService.healthCheck()

      const unhealthy = Object.values(healthCheck).includes(
        HealthStatus.Unhealthy
      )

      if (unhealthy) {
        logger.warn(
          `Health check failed response=${JSON.stringify(healthCheck)}`
        )
      }

      response.status(unhealthy ? 503 : 200).json(healthCheck)
    })
