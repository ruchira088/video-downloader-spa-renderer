import { HealthCheckConfiguration } from "./HealthCheckConfiguration"

describe("HealthCheckConfiguration", () => {
  test("parses a URL with the CSS selectors to wait for", () => {
    expect(
      HealthCheckConfiguration.parse({
        url: "https://spa-health-check.ruchij.com",
        readyCssSelectors: ["#text-field", ".class-name"],
      })
    ).toEqual({
      url: "https://spa-health-check.ruchij.com",
      readyCssSelectors: ["#text-field", ".class-name"],
    })
  })

  test("allows an empty list of selectors", () => {
    expect(
      HealthCheckConfiguration.parse({
        url: "https://example.com",
        readyCssSelectors: [],
      }).readyCssSelectors
    ).toEqual([])
  })

  test.each([
    ["a malformed URL", "not a url"],
    ["an empty string", ""],
  ])("rejects %s", (_name, url) => {
    const result = HealthCheckConfiguration.safeParse({
      url,
      readyCssSelectors: [],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["url"])
  })

  test("requires the selectors to be present", () => {
    const result = HealthCheckConfiguration.safeParse({
      url: "https://example.com",
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["readyCssSelectors"])
  })

  test("requires the selectors to be strings", () => {
    const result = HealthCheckConfiguration.safeParse({
      url: "https://example.com",
      readyCssSelectors: [1, 2],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["readyCssSelectors", 0])
  })
})
