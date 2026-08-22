import { HttpConfiguration } from "./HttpConfiguration"

describe("HttpConfiguration", () => {
  test("parses a valid host and port", () => {
    expect(HttpConfiguration.parse({ host: "127.0.0.1", port: 8000 })).toEqual({
      host: "127.0.0.1",
      port: 8000,
    })
  })

  test("coerces a port supplied as a string, as environment variables are", () => {
    expect(HttpConfiguration.parse({ host: "0.0.0.0", port: "8000" })).toEqual({
      host: "0.0.0.0",
      port: 8000,
    })
  })

  test.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 80.5],
    ["not a number", "not-a-port"],
  ])("rejects a %s port", (_name, port) => {
    const result = HttpConfiguration.safeParse({ host: "0.0.0.0", port })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["port"])
  })

  test.each([
    ["a hostname", "localhost"],
    ["an IPv6 address", "::1"],
    ["an out of range octet", "999.0.0.1"],
    ["an empty string", ""],
  ])("rejects %s as the host", (_name, host) => {
    const result = HttpConfiguration.safeParse({ host, port: 8000 })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["host"])
  })
})
