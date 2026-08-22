import config from "config"
import { ApplicationConfiguration } from "./ApplicationConfiguration"

describe("ApplicationConfiguration", () => {
  const validConfiguration = {
    httpConfiguration: {
      host: "1.1.1.1",
      port: 1234,
    },
    buildInformation: {
      gitBranch: "git-branch",
      gitCommit: "git-commit",
      buildTimestamp: "2021-01-01T00:00:00.000Z",
    },
    healthCheckConfiguration: {
      url: "https://example.com",
      readyCssSelectors: ["#selector"],
    },
  }

  test("parses every section of the configuration", () => {
    const applicationConfiguration: ApplicationConfiguration =
      ApplicationConfiguration.parse(validConfiguration)

    expect(applicationConfiguration.httpConfiguration).toStrictEqual({
      host: "1.1.1.1",
      port: 1234,
    })

    expect(applicationConfiguration.buildInformation).toStrictEqual({
      gitBranch: "git-branch",
      gitCommit: "git-commit",
      buildTimestamp: new Date("2021-01-01T00:00:00.000Z"),
    })

    expect(applicationConfiguration.healthCheckConfiguration).toStrictEqual({
      url: "https://example.com",
      readyCssSelectors: ["#selector"],
    })
  })

  test.each([
    "httpConfiguration",
    "buildInformation",
    "healthCheckConfiguration",
  ])("rejects a configuration without %s", (section) => {
    const { [section]: _omitted, ...rest } = validConfiguration as Record<
      string,
      unknown
    >

    const result = ApplicationConfiguration.safeParse(rest)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([section])
  })

  test("reports every invalid section at once", () => {
    const result = ApplicationConfiguration.safeParse({
      httpConfiguration: { host: "localhost", port: 1234 },
      buildInformation: validConfiguration.buildInformation,
      healthCheckConfiguration: { url: "nope", readyCssSelectors: [] },
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["httpConfiguration", "host"],
      ["healthCheckConfiguration", "url"],
    ])
  })

  // `main.ts` parses the `config` package output at startup and exits when it
  // does not match, so the bundled configuration files must satisfy the schema.
  test("accepts the configuration files bundled with the service", () => {
    expect(() => ApplicationConfiguration.parse(config)).not.toThrow()
  })
})
