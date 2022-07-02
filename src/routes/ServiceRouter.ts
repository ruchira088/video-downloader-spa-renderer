import express, {Request, Response} from "express"
import {HealthService, HealthStatus} from "../services/HealthService"

export const create = (healthService: HealthService) =>
    express.Router()
        .get("/information", (request: Request, response: Response) => {
            response.status(200).json(healthService.serviceInformation())
        })
        .get("/health-check", async (request: Request, response: Response) => {
            const healthCheck = await healthService.healthCheck()

            const statusCode =
                Object.values<HealthStatus>(healthCheck).some(healthStatus => healthStatus === "unhealthy") ? 503 : 200

            response.status(statusCode).json(healthCheck)
        })