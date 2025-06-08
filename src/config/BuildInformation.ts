import { z } from "zod/v4"
import { filter, map } from "../utils/Helpers"

export const BuildInformation = z.object({
  gitBranch: z.string(),
  gitCommit: z.string(),
  buildTimestamp: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform((value) =>
      map(
        filter(value?.trim(), (input) => input !== ""),
        (timestamp) => new Date(timestamp)
      )
    ),
})

export type BuildInformation = z.infer<typeof BuildInformation>

export const buildInformation = (env: NodeJS.ProcessEnv): BuildInformation => {
  const gitBranch =
    filter(env.GIT_BRANCH?.trim(), (value) => value !== "") ?? "my-branch"

  const gitCommit =
    filter(env.GIT_COMMIT?.trim(), (value) => value !== "") ?? "my-commit"

  const buildTimestamp = filter(
    env.BUILD_TIMESTAMP?.trim(),
    (value) => value !== ""
  )

  return BuildInformation.parse({ gitBranch, gitCommit, buildTimestamp })
}
