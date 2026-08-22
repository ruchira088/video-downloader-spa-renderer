import { z } from "zod/v4"
import { filter, map } from "../utils/Helpers"

export const BuildInformation = z.object({
  gitBranch: z.string(),
  gitCommit: z.string(),
  // `config/default.json` ships placeholders that `scripts/build-info.ts`
  // overwrites at build time, so a blank timestamp means the build information
  // was never filled in. Blank it out before validation so that it reads as an
  // absent timestamp rather than a malformed one.
  buildTimestamp: z
    .preprocess(
      (value) =>
        filter(
          typeof value === "string" ? value.trim() : value,
          (input) => input !== ""
        ),
      z.iso.datetime({ offset: true }).nullish()
    )
    .transform((value) => map(value, (timestamp) => new Date(timestamp))),
})

export type BuildInformation = z.infer<typeof BuildInformation>
