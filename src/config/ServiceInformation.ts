import moment, {Moment} from "moment"
import {Maybe} from "monet"

export interface ServiceInformation {
    readonly gitBranch: string
    readonly gitCommit: string
    readonly buildTimestamp: Maybe<Moment>
}

export const serviceInformation = (env: NodeJS.ProcessEnv) => {
    const gitBranch = Maybe.fromNull(env.GIT_BRANCH).orJust("my-branch")
    const gitCommit = Maybe.fromNull(env.GIT_COMMIT).orJust("my-commit")
    const buildTimestamp = Maybe.fromNull(env.BUILD_TIMESTAMP).map(moment)

    return { gitBranch, gitCommit, buildTimestamp}
}