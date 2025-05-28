import express, {Request, Response, Router} from "express"
import {HealthService, HealthStatus} from "../services/HealthService"

export const createServiceRouter = (healthService: HealthService): Router =>
    express.Router()
        .get("/information", (request: Request, response: Response) => {
            response.status(200).json(healthService.serviceInformation())
        })
        .get("/health-check", async (request: Request, response: Response) => {
            const healthCheck = await healthService.healthCheck()

            const statusCode: 200 | 503 =
                Object.values<HealthStatus>(healthCheck)
                    .some(healthStatus => healthStatus === HealthStatus.Unhealthy) ? 503 : 200

            response.status(statusCode).json(healthCheck)
        })