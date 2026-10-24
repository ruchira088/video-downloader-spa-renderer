import { RendererBusyError } from "./RendererBusyError"

describe("RendererBusyError", () => {
  test("carries a 503 status and a retry hint", () => {
    const error = new RendererBusyError()

    expect(error.status).toBe(503)
    expect(error.retryAfterSeconds).toBeGreaterThan(0)
    expect(error.name).toBe("RendererBusyError")
    expect(error).toBeInstanceOf(Error)
  })
})
