import { HealthServiceImpl, HealthStatus, PackageJson } from "./HealthService"
import { RenderingService } from "./RenderingService"
import { AxiosInstance } from "axios"
import { BuildInformation } from "../config/BuildInformation"
import { HealthCheckConfiguration } from "../config/HealthCheckConfiguration"
import { Clock } from "../utils/Clock"

describe("HealthService", () => {
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

  const fixedClock = (
    timestamp: string = "2024-01-01T00:00:00.000Z"
  ): Clock => ({
    timestamp: () => new Date(timestamp),
  })

  const createHealthService = ({
    renderingService = {} as jest.Mocked<RenderingService>,
    axiosInstance = {} as AxiosInstance,
    buildInformation = mockBuildInformation,
    clock = fixedClock(),
  }: {
    renderingService?: RenderingService
    axiosInstance?: AxiosInstance
    buildInformation?: BuildInformation
    clock?: Clock
  } = {}): HealthServiceImpl =>
    new HealthServiceImpl(
      renderingService,
      axiosInstance,
      mockPackageJson,
      buildInformation,
      mockHealthCheckConfiguration,
      clock
    )

  const renderingServiceThat = (
    render: jest.Mock
  ): jest.Mocked<RenderingService> => ({ render, execute: jest.fn() })

  const axiosInstanceThat = (get: jest.Mock): AxiosInstance =>
    ({ get }) as unknown as AxiosInstance

  describe("serviceInformation", () => {
    test("returns application information", () => {
      const info = createHealthService().serviceInformation()

      expect(info).toStrictEqual({
        name: "test-app",
        timestamp: "2024-01-01T00:00:00.000Z",
        gitBranch: "main",
        gitCommit: "abc123",
        buildTimestamp: "2024-01-01T00:00:00.000Z",
      })
    })

    test.each([
      ["undefined", undefined],
      ["null", null],
    ])(
      "reports an unknown build timestamp when it is %s",
      (_name, buildTimestamp) => {
        const info = createHealthService({
          buildInformation: { ...mockBuildInformation, buildTimestamp },
        }).serviceInformation()

        expect(info.buildTimestamp).toBe("Unknown")
      }
    )

    test("reads the clock on every call", () => {
      const timestamps = [
        "2024-01-01T00:00:00.000Z",
        "2024-01-01T00:00:01.000Z",
      ]
      const clock: Clock = {
        timestamp: () => new Date(timestamps.shift() as string),
      }

      const healthService = createHealthService({ clock })

      expect(healthService.serviceInformation().timestamp).toBe(
        "2024-01-01T00:00:00.000Z"
      )
      expect(healthService.serviceInformation().timestamp).toBe(
        "2024-01-01T00:00:01.000Z"
      )
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
      const render = jest.fn().mockResolvedValue("<html></html>")
      const get = jest.fn().mockResolvedValue({ status: 200 })

      const result = await createHealthService({
        renderingService: renderingServiceThat(render),
        axiosInstance: axiosInstanceThat(get),
      }).healthCheck()

      expect(result).toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Healthy,
      })
      expect(get).toHaveBeenCalledWith("https://example.com")
      expect(render).toHaveBeenCalledWith("https://example.com", ["#test"])
    })

    test("returns unhealthy for internet connectivity when the request fails", async () => {
      const result = await createHealthService({
        renderingService: renderingServiceThat(
          jest.fn().mockResolvedValue("<html></html>")
        ),
        axiosInstance: axiosInstanceThat(
          jest.fn().mockRejectedValue(new Error("Network error"))
        ),
      }).healthCheck()

      expect(result.internetConnectivity).toBe(HealthStatus.Unhealthy)
      expect(result.spaRendering).toBe(HealthStatus.Healthy)
    })

    test("returns unhealthy for SPA rendering when the render fails", async () => {
      const result = await createHealthService({
        renderingService: renderingServiceThat(
          jest.fn().mockRejectedValue(new Error("Render failed"))
        ),
        axiosInstance: axiosInstanceThat(
          jest.fn().mockResolvedValue({ status: 200 })
        ),
      }).healthCheck()

      expect(result.internetConnectivity).toBe(HealthStatus.Healthy)
      expect(result.spaRendering).toBe(HealthStatus.Unhealthy)
    })

    test("returns unhealthy when both checks fail", async () => {
      const result = await createHealthService({
        renderingService: renderingServiceThat(
          jest.fn().mockRejectedValue(new Error("Render failed"))
        ),
        axiosInstance: axiosInstanceThat(
          jest.fn().mockRejectedValue(new Error("Network error"))
        ),
      }).healthCheck()

      expect(result).toStrictEqual({
        internetConnectivity: HealthStatus.Unhealthy,
        spaRendering: HealthStatus.Unhealthy,
      })
    })

    test.each([
      ["a 500", 500],
      ["a 301", 301],
      ["a 204", 204],
    ])(
      "returns unhealthy for internet connectivity on %s response",
      async (_name, status) => {
        const result = await createHealthService({
          renderingService: renderingServiceThat(
            jest.fn().mockResolvedValue("<html></html>")
          ),
          axiosInstance: axiosInstanceThat(
            jest.fn().mockResolvedValue({ status })
          ),
        }).healthCheck()

        expect(result.internetConnectivity).toBe(HealthStatus.Unhealthy)
      }
    )

    test("gives up on the internet connectivity check after 5 seconds", async () => {
      const healthCheck = createHealthService({
        renderingService: renderingServiceThat(
          jest.fn().mockResolvedValue("<html></html>")
        ),
        axiosInstance: axiosInstanceThat(
          jest.fn().mockReturnValue(neverEnds())
        ),
      }).healthCheck()

      await jest.advanceTimersByTimeAsync(5_000)

      await expect(healthCheck).resolves.toStrictEqual({
        internetConnectivity: HealthStatus.Unhealthy,
        spaRendering: HealthStatus.Healthy,
      })
    })

    test("gives up on the SPA rendering check after 10 seconds", async () => {
      const healthCheck = createHealthService({
        renderingService: renderingServiceThat(
          jest.fn().mockReturnValue(neverEnds())
        ),
        axiosInstance: axiosInstanceThat(
          jest.fn().mockResolvedValue({ status: 200 })
        ),
      }).healthCheck()

      await jest.advanceTimersByTimeAsync(10_000)

      await expect(healthCheck).resolves.toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Unhealthy,
      })
    })

    test("starts both checks before awaiting either of them", async () => {
      const render = jest.fn().mockReturnValue(neverEnds())
      const get = jest.fn().mockReturnValue(neverEnds())

      const healthCheck = createHealthService({
        renderingService: renderingServiceThat(render),
        axiosInstance: axiosInstanceThat(get),
      }).healthCheck()

      expect(get).toHaveBeenCalledTimes(1)
      expect(render).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(15_000)
      await healthCheck
    })
  })
})

const neverEnds = <A>(): Promise<A> =>
  new Promise(() => {
    /* deliberately never settles */
  })
