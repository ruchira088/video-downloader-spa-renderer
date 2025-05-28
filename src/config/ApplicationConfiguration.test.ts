import {ApplicationConfiguration, createApplicationConfiguration} from "./ApplicationConfiguration";

describe("ApplicationConfiguration", () => {
    describe("createApplicationConfiguration", () => {
        test("should parse the environment variables", () => {
            const applicationConfiguration: ApplicationConfiguration = createApplicationConfiguration({
                HTTP_PORT: "1234",
                HTTP_HOST: "1.1.1.1",
                GIT_BRANCH: "git-branch",
                GIT_COMMIT: "git-commit",
                BUILD_TIMESTAMP: "2021-01-01T00:00:00.000Z"
            })

            expect(applicationConfiguration.httpConfiguration.host).toEqual("1.1.1.1")
            expect(applicationConfiguration.httpConfiguration.port).toEqual(1234)

            expect(applicationConfiguration.serviceInformation.gitBranch).toEqual("git-branch")
            expect(applicationConfiguration.serviceInformation.gitCommit).toEqual("git-commit")
            expect(applicationConfiguration.serviceInformation.buildTimestamp).toEqual(new Date("2021-01-01T00:00:00.000Z"))
        })
    })
})