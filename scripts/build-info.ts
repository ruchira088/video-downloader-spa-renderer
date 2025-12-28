import SimpleGit from "simple-git"
import path from "node:path"
import {readFile, writeFile} from "node:fs/promises"

type BuildInfo = {
    readonly gitBranch: string,
    readonly gitCommit: string,
    readonly buildTimestamp: string
}

const generateBuildInfo = async (): Promise<BuildInfo> => {
    const simpleGit = SimpleGit()

    const gitBranch = await simpleGit.branch()
    const gitCommit = await simpleGit.revparse(["--short", "HEAD"])

    const buildTimestamp = new Date().toISOString()

    return {
        gitCommit,
        buildTimestamp,
        gitBranch: gitBranch.current
    }
}

const updateConfig = async (buildInfo: BuildInfo): Promise<void> => {
    const defaultConfigPath = path.resolve(__dirname, "../build/config/default.json")
    const config: Record<string, any> = JSON.parse(await readFile(defaultConfigPath, "utf-8"))
    const updatedConfig = {...config, buildInformation: buildInfo}
    await writeFile(defaultConfigPath, JSON.stringify(updatedConfig, null, 2))
}

const main = async (): Promise<void> => {
    const buildInfo = await generateBuildInfo()
    await updateConfig(buildInfo)
}

main()