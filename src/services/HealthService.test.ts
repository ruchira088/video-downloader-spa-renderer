import { HealthServiceImpl, HealthStatus, PackageJson } from "./HealthService"
import { RenderingService } from "./RenderingService"
import { AxiosInstance } from "axios"
import { BuildInformation } from "../config/BuildInformation"
import { HealthCheckConfiguration } from "../config/HealthCheckConfiguration"
import { Clock } from "../utils/Clock"
import { fixedClock } from "../test/FixedClock"

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

  const rendering = {
    succeeds: () => renderingServiceThat(jest.fn().mockResolvedValue("<html>")),
    fails: () =>
      renderingServiceThat(jest.fn().mockRejectedValue(new Error("Failed"))),
    hangs: () => renderingServiceThat(jest.fn().mockReturnValue(neverEnds())),
  }

  const connectivity = {
    succeeds: () =>
      axiosInstanceThat(jest.fn().mockResolvedValue({ status: 200 })),
    fails: () =>
      axiosInstanceThat(
        jest.fn().mockRejectedValue(new Error("Network error"))
      ),
    hangs: () => axiosInstanceThat(jest.fn().mockReturnValue(neverEnds())),
  }

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
      const renderingService = rendering.succeeds()
      const axiosInstance = connectivity.succeeds()

      const result = await createHealthService({
        renderingService,
        axiosInstance,
      }).healthCheck()

      expect(result).toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Healthy,
      })
      expect(axiosInstance.get).toHaveBeenCalledWith("https://example.com")
      expect(renderingService.render).toHaveBeenCalledWith(
        "https://example.com",
        ["#test"]
      )
    })

    test("returns unhealthy for internet connectivity when the request fails", async () => {
      const result = await createHealthService({
        renderingService: rendering.succeeds(),
        axiosInstance: connectivity.fails(),
      }).healthCheck()

      expect(result).toStrictEqual({
        internetConnectivity: HealthStatus.Unhealthy,
        spaRendering: HealthStatus.Healthy,
      })
    })

    test("returns unhealthy for SPA rendering when the render fails", async () => {
      const result = await createHealthService({
        renderingService: rendering.fails(),
        axiosInstance: connectivity.succeeds(),
      }).healthCheck()

      expect(result).toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Unhealthy,
      })
    })

    test("returns unhealthy when both checks fail", async () => {
      const result = await createHealthService({
        renderingService: rendering.fails(),
        axiosInstance: connectivity.fails(),
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
          renderingService: rendering.succeeds(),
          axiosInstance: axiosInstanceThat(
            jest.fn().mockResolvedValue({ status })
          ),
        }).healthCheck()

        expect(result.internetConnectivity).toBe(HealthStatus.Unhealthy)
      }
    )

    test("gives up on the internet connectivity check after 5 seconds", async () => {
      const healthCheck = createHealthService({
        renderingService: rendering.succeeds(),
        axiosInstance: connectivity.hangs(),
      }).healthCheck()

      await jest.advanceTimersByTimeAsync(5_000)

      await expect(healthCheck).resolves.toStrictEqual({
        internetConnectivity: HealthStatus.Unhealthy,
        spaRendering: HealthStatus.Healthy,
      })
    })

    test("gives up on the SPA rendering check after 10 seconds", async () => {
      const healthCheck = createHealthService({
        renderingService: rendering.hangs(),
        axiosInstance: connectivity.succeeds(),
      }).healthCheck()

      await jest.advanceTimersByTimeAsync(10_000)

      await expect(healthCheck).resolves.toStrictEqual({
        internetConnectivity: HealthStatus.Healthy,
        spaRendering: HealthStatus.Unhealthy,
      })
    })

    test("starts both checks before awaiting either of them", async () => {
      const renderingService = rendering.hangs()
      const axiosInstance = connectivity.hangs()

      const healthCheck = createHealthService({
        renderingService,
        axiosInstance,
      }).healthCheck()

      expect(axiosInstance.get).toHaveBeenCalledTimes(1)
      expect(renderingService.render).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(10_000)
      await healthCheck
    })

    // The timeouts run concurrently, so the check as a whole is bounded by
    // the longer of the two rather than by their sum.
    test("completes within 10 seconds even when both checks hang", async () => {
      const healthCheck = createHealthService({
        renderingService: rendering.hangs(),
        axiosInstance: connectivity.hangs(),
      }).healthCheck()

      await jest.advanceTimersByTimeAsync(10_000)

      await expect(healthCheck).resolves.toStrictEqual({
        internetConnectivity: HealthStatus.Unhealthy,
        spaRendering: HealthStatus.Unhealthy,
      })
    })

    test("leaves no timer running once both checks have settled", async () => {
      await createHealthService({
        renderingService: rendering.succeeds(),
        axiosInstance: connectivity.succeeds(),
      }).healthCheck()

      expect(jest.getTimerCount()).toBe(0)
    })
  })
})

const neverEnds = <A>(): Promise<A> =>
  new Promise(() => {
    /* deliberately never settles */
  })
