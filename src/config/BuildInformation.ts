import { z } from "zod"

// `config/default.json` ships placeholders that `scripts/build-info.ts`
// overwrites at build time, so a blank timestamp means the build information
// was never filled in. Blank it out before validation so that it reads as an
// absent timestamp rather than a malformed one.
const blankToNull = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}

export const BuildInformation = z.object({
  gitBranch: z.string(),
  gitCommit: z.string(),
  buildTimestamp: z
    .preprocess(blankToNull, z.iso.datetime({ offset: true }).nullish())
    .transform((timestamp) =>
      timestamp === null || timestamp === undefined
        ? timestamp
        : new Date(timestamp)
    ),
})

export type BuildInformation = z.infer<typeof BuildInformation>
