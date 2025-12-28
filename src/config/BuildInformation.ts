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
