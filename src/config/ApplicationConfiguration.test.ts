import { ApplicationConfiguration } from "./ApplicationConfiguration"

describe("ApplicationConfiguration", () => {
  describe("createApplicationConfiguration", () => {
    test("should parse the environment variables", () => {
      const applicationConfiguration: ApplicationConfiguration =
        ApplicationConfiguration.parse({
          httpConfiguration: {
            host: "1.1.1.1",
            port: 1234,
          },
          buildInformation: {
            gitBranch: "git-branch",
            gitCommit: "git-commit",
            buildTimestamp: "2021-01-01T00:00:00.000Z",
          },
        })

      expect(applicationConfiguration.httpConfiguration.host).toEqual("1.1.1.1")
      expect(applicationConfiguration.httpConfiguration.port).toEqual(1234)

      expect(applicationConfiguration.buildInformation.gitBranch).toEqual(
        "git-branch"
      )
      expect(applicationConfiguration.buildInformation.gitCommit).toEqual(
        "git-commit"
      )
      expect(applicationConfiguration.buildInformation.buildTimestamp).toEqual(
        new Date("2021-01-01T00:00:00.000Z")
      )
    })
  })
})
