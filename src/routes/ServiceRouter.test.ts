import request from "supertest"
import express, { Express } from "express"
import { createServiceRouter } from "./ServiceRouter"
import errorHandler from "../middleware/ErrorHandler"
import {
  HealthCheck,
  HealthService,
  HealthStatus,
} from "../services/HealthService"

describe("ServiceRouter", () => {
  const applicationInformation = {
    name: "video-downloader-spa-renderer",
    timestamp: "2024-01-01T00:00:00.000Z",
    gitBranch: "main",
    gitCommit: "abc123",
    buildTimestamp: "2023-12-31T00:00:00.000Z",
  }

  let healthService: jest.Mocked<HealthService>
  let app: Express

  beforeEach(() => {
    healthService = {
      serviceInformation: jest.fn().mockReturnValue(applicationInformation),
      healthCheck: jest.fn().mockResolvedValue({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Healthy,
      }),
    }

    app = express()
      .use("/service", createServiceRouter(healthService))
      .use(errorHandler)
  })

  describe("GET /service/information", () => {
    test("responds with the application information as JSON", async () => {
      const response = await request(app).get("/service/information")

      expect(response.status).toBe(200)
      expect(response.headers["content-type"]).toMatch(/application\/json/u)
      expect(response.body).toStrictEqual(applicationInformation)
    })

    test("responds with 500 when gathering the information fails", async () => {
      healthService.serviceInformation.mockImplementation(() => {
        throw new Error("Build information unavailable")
      })

      const response = await request(app).get("/service/information")

      expect(response.status).toBe(500)
      expect(response.body).toStrictEqual({
        errorMessages: ["Build information unavailable"],
      })
    })
  })

  describe("GET /service/health-check", () => {
    const healthCheckResponds = (healthCheck: HealthCheck): void => {
      healthService.healthCheck.mockResolvedValue(healthCheck)
    }

    test("responds with 200 when every check is healthy", async () => {
      const response = await request(app).get("/service/health-check")

      expect(response.status).toBe(200)
      expect(response.body).toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Healthy,
      })
    })

    test.each([
      [
        "internet connectivity is unhealthy",
        {
          internetConnectivity: HealthStatus.Unhealthy,
          spaRendering: HealthStatus.Healthy,
        },
      ],
      [
        "SPA rendering is unhealthy",
        {
          internetConnectivity: HealthStatus.Healthy,
          spaRendering: HealthStatus.Unhealthy,
        },
      ],
      [
        "every check is unhealthy",
        {
          internetConnectivity: HealthStatus.Unhealthy,
          spaRendering: HealthStatus.Unhealthy,
        },
      ],
    ])("responds with 503 when %s", async (_description, healthCheck) => {
      healthCheckResponds(healthCheck)

      const response = await request(app).get("/service/health-check")

      expect(response.status).toBe(503)
      expect(response.body).toStrictEqual(healthCheck)
    })

    test("responds with 500 when the health check itself fails", async () => {
      healthService.healthCheck.mockRejectedValue(new Error("Check exploded"))

      const response = await request(app).get("/service/health-check")

      expect(response.status).toBe(500)
      expect(response.body).toStrictEqual({
        errorMessages: ["Check exploded"],
      })
    })
  })

  test("does not handle unknown paths under /service", async () => {
    const response = await request(app).get("/service/unknown")

    expect(response.status).toBe(404)
  })
})
