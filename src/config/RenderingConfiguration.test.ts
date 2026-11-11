import { RenderingConfiguration } from "./RenderingConfiguration"

describe("RenderingConfiguration", () => {
  const valid = {
    renderTimeoutMs: 60_000,
    maxConcurrentRenders: 4,
    maxQueuedRenders: 8,
  }

  test("parses valid limits", () => {
    expect(RenderingConfiguration.parse(valid)).toEqual(valid)
  })

  test("coerces limits supplied as strings, as environment variables are", () => {
    expect(
      RenderingConfiguration.parse({
        renderTimeoutMs: "45000",
        maxConcurrentRenders: "2",
        maxQueuedRenders: "0",
      })
    ).toEqual({
      renderTimeoutMs: 45_000,
      maxConcurrentRenders: 2,
      maxQueuedRenders: 0,
    })
  })

  test("accepts an optional HTTP proxy URL", () => {
    expect(
      RenderingConfiguration.parse({
        ...valid,
        proxyUrl: "http://forward-proxy-service:8888",
      })
    ).toEqual({ ...valid, proxyUrl: "http://forward-proxy-service:8888" })
  })

  test.each(["not a url", "socks5://proxy:1080", ""])(
    "rejects a proxyUrl of %p",
    (proxyUrl) => {
      const result = RenderingConfiguration.safeParse({ ...valid, proxyUrl })

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(["proxyUrl"])
    }
  )

  // A queue of zero is valid: it sheds every request that finds the slots
  // busy. Running no renders at all is not.
  test.each([
    ["renderTimeoutMs", 0],
    ["renderTimeoutMs", 1.5],
    ["maxConcurrentRenders", 0],
    ["maxConcurrentRenders", -1],
    ["maxQueuedRenders", -1],
    ["maxQueuedRenders", "lots"],
  ])("rejects %s of %p", (field, value) => {
    const result = RenderingConfiguration.safeParse({
      ...valid,
      [field]: value,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([field])
  })
})
