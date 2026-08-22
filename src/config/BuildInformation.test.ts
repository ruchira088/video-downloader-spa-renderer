import { BuildInformation } from "./BuildInformation"

describe("BuildInformation", () => {
  const gitFields = { gitBranch: "main", gitCommit: "abc123" }

  test("parses an ISO timestamp into a Date", () => {
    const buildInformation = BuildInformation.parse({
      ...gitFields,
      buildTimestamp: "2021-01-01T00:00:00.000Z",
    })

    expect(buildInformation.buildTimestamp).toEqual(
      new Date("2021-01-01T00:00:00.000Z")
    )
  })

  test("normalises a timestamp with a UTC offset", () => {
    const buildInformation = BuildInformation.parse({
      ...gitFields,
      buildTimestamp: "2021-01-01T00:00:00+05:30",
    })

    expect(buildInformation.buildTimestamp).toEqual(
      new Date("2020-12-31T18:30:00.000Z")
    )
  })

  test("trims a padded timestamp", () => {
    const buildInformation = BuildInformation.parse({
      ...gitFields,
      buildTimestamp: "  2021-01-01T00:00:00.000Z  ",
    })

    expect(buildInformation.buildTimestamp).toEqual(
      new Date("2021-01-01T00:00:00.000Z")
    )
  })

  // `config/default.json` ships placeholders until `scripts/build-info.ts`
  // fills them in, so a blank timestamp means "not built yet" rather than
  // "malformed".
  test.each([
    ["null", null],
    ["an empty string", ""],
    ["blank whitespace", "   "],
  ])("treats %s as an absent timestamp", (_name, buildTimestamp) => {
    const buildInformation = BuildInformation.parse({
      ...gitFields,
      buildTimestamp,
    })

    expect(buildInformation.buildTimestamp).toBeNull()
  })

  test("yields undefined when the timestamp is undefined", () => {
    const buildInformation = BuildInformation.parse({
      ...gitFields,
      buildTimestamp: undefined,
    })

    expect(buildInformation.buildTimestamp).toBeUndefined()
  })

  test("yields undefined when the timestamp is absent", () => {
    const buildInformation = BuildInformation.parse(gitFields)

    expect(buildInformation.buildTimestamp).toBeUndefined()
  })

  test.each([
    ["a timestamp without a timezone", "2021-01-01T00:00:00"],
    ["a date without a time", "2021-01-01"],
    ["nonsense", "not-a-timestamp"],
    ["a number", 1_700_000_000],
  ])("rejects %s as a timestamp", (_name, buildTimestamp) => {
    const result = BuildInformation.safeParse({
      ...gitFields,
      buildTimestamp,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["buildTimestamp"])
  })

  test("requires the git branch and commit", () => {
    const result = BuildInformation.safeParse({
      buildTimestamp: "2021-01-01T00:00:00.000Z",
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["gitBranch"],
      ["gitCommit"],
    ])
  })
})
