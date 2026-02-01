import { HealthServiceImpl, HealthStatus, PackageJson } from "./HealthService"
import { RenderingService } from "./RenderingService"
import { AxiosInstance } from "axios"
import { BuildInformation } from "../config/BuildInformation"
import { HealthCheckConfiguration } from "../config/HealthCheckConfiguration"
import { Clock } from "../utils/Clock"

describe("HealthService", () => {
  const mockClock: Clock = {
    timestamp: () => new Date("2024-01-01T00:00:00.000Z"),
  }

  const mockPackageJson: PackageJson = { name: "test-app" }

  const mockBuildInformation: BuildInformation = {
    gitBranch: "main",
    gitCommit: "abc123",
    buildTimestamp: new Date("2024-01-01T00:00:00.000Z"),
  }

  const mockHealthCheckConfiguration: HealthCheckConfiguration = {
    url: "https://example.com",
    readyCssSelectors: ["#test"],
  }

  describe("serviceInformation", () => {
    test("returns application information", () => {
      const mockRenderingService = {} as RenderingService
      const mockAxiosInstance = {} as AxiosInstance

      const healthService = new HealthServiceImpl(
        mockRenderingService,
        mockAxiosInstance,
        mockPackageJson,
        mockBuildInformation,
        mockHealthCheckConfiguration,
        mockClock
      )

      const info = healthService.serviceInformation()

      expect(info.name).toBe("test-app")
      expect(info.gitBranch).toBe("main")
      expect(info.gitCommit).toBe("abc123")
      expect(info.timestamp).toBe("2024-01-01T00:00:00.000Z")
      expect(info.buildTimestamp).toBe("2024-01-01T00:00:00.000Z")
    })
  })

  describe("healthCheck", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test("returns healthy when both checks pass", async () => {
      const mockRenderingService: jest.Mocked<RenderingService> = {
        render: jest.fn().mockResolvedValue("<html></html>"),
        execute: jest.fn(),
      }

      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue({ status: 200 }),
      } as unknown as AxiosInstance

      const healthService = new HealthServiceImpl(
        mockRenderingService,
        mockAxiosInstance,
        mockPackageJson,
        mockBuildInformation,
        mockHealthCheckConfiguration,
        mockClock
      )

      const result = await healthService.healthCheck()

      expect(result.internetConnectivity).toBe(HealthStatus.Healthy)
      expect(result.spaRendering).toBe(HealthStatus.Healthy)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("https://example.com")
      expect(mockRenderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        ["#test"]
      )
    })

    test("returns unhealthy for internet connectivity when request fails", async () => {
      const mockRenderingService: jest.Mocked<RenderingService> = {
        render: jest.fn().mockResolvedValue("<html></html>"),
        execute: jest.fn(),
      }

      const mockAxiosInstance = {
        get: jest.fn().mockRejectedValue(new Error("Network error")),
      } as unknown as AxiosInstance

      const healthService = new HealthServiceImpl(
        mockRenderingService,
        mockAxiosInstance,
        mockPackageJson,
        mockBuildInformation,
        mockHealthCheckConfiguration,
        mockClock
      )

      const result = await healthService.healthCheck()

      expect(result.internetConnectivity).toBe(HealthStatus.Unhealthy)
      expect(result.spaRendering).toBe(HealthStatus.Healthy)
    })

    test("returns unhealthy for SPA rendering when render fails", async () => {
      const mockRenderingService: jest.Mocked<RenderingService> = {
        render: jest.fn().mockRejectedValue(new Error("Render failed")),
        execute: jest.fn(),
      }

      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue({ status: 200 }),
      } as unknown as AxiosInstance

      const healthService = new HealthServiceImpl(
        mockRenderingService,
        mockAxiosInstance,
        mockPackageJson,
        mockBuildInformation,
        mockHealthCheckConfiguration,
        mockClock
      )

      const result = await healthService.healthCheck()

      expect(result.internetConnectivity).toBe(HealthStatus.Healthy)
      expect(result.spaRendering).toBe(HealthStatus.Unhealthy)
    })

    test("returns unhealthy when non-200 status is returned", async () => {
      const mockRenderingService: jest.Mocked<RenderingService> = {
        render: jest.fn().mockResolvedValue("<html></html>"),
        execute: jest.fn(),
      }

      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue({ status: 500 }),
      } as unknown as AxiosInstance

      const healthService = new HealthServiceImpl(
        mockRenderingService,
        mockAxiosInstance,
        mockPackageJson,
        mockBuildInformation,
        mockHealthCheckConfiguration,
        mockClock
      )

      const result = await healthService.healthCheck()

      expect(result.internetConnectivity).toBe(HealthStatus.Unhealthy)
    })
  })
})
