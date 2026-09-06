import { RenderingError } from "./RenderingError"

describe("RenderingError", () => {
  test("is an Error named after itself", () => {
    const error = new RenderingError("Navigation failed")

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("RenderingError")
    expect(error.message).toBe("Navigation failed")
  })

  // The error handler honours the 4xx status an error carries, which is what
  // lets the routes report request failures as 400 without handling them.
  test("carries the 400 status of a request failure", () => {
    expect(new RenderingError("Navigation failed").status).toBe(400)
  })

  test("retains the underlying failure as its cause", () => {
    const cause = new Error("net::ERR_CONNECTION_REFUSED")

    expect(new RenderingError("Navigation failed", cause).cause).toBe(cause)
  })

  test("has no cause when none is supplied", () => {
    expect(new RenderingError("Navigation failed").cause).toBeUndefined()
  })
})
