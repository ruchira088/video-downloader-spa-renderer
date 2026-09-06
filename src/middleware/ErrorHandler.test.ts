import request from "supertest"
import express, { Express, NextFunction, Request, Response } from "express"
import errorHandler from "./ErrorHandler"
import { z, ZodError } from "zod"

describe("ErrorHandler middleware", () => {
  const createTestApp = (errorToThrow: () => Error): Express => {
    const app = express()
    app.get(
      "/test",
      (_request: Request, _response: Response, next: NextFunction) => {
        next(errorToThrow())
      }
    )
    app.use(errorHandler)
    return app
  }

  const zodErrorFor = (value: unknown): ZodError => {
    const result = z
      .object({ name: z.string(), age: z.number() })
      .safeParse(value)

    if (result.success) {
      throw new Error("Expected parsing to fail")
    }

    return result.error
  }

  test("responds to a ZodError with 400 and the underlying issues", async () => {
    const app = createTestApp(() => zodErrorFor({ name: 123, age: "old" }))

    const response = await request(app).get("/test")

    expect(response.status).toBe(400)
    expect(response.headers["content-type"]).toMatch(/application\/json/u)
    expect(response.body.errorMessages).toHaveLength(2)
    expect(
      response.body.errorMessages.map((issue: { path: string[] }) => issue.path)
    ).toEqual([["name"], ["age"]])
    expect(response.body.errorMessages[0]).toMatchObject({
      code: "invalid_type",
      expected: "string",
    })
  })

  test("responds to a generic Error with 500 and its message", async () => {
    const app = createTestApp(() => new Error("Something went wrong"))

    const response = await request(app).get("/test")

    expect(response.status).toBe(500)
    expect(response.body).toStrictEqual({
      errorMessages: ["Something went wrong"],
    })
  })

  test.each([
    ["a TypeError", () => new TypeError("Not a function")],
    ["a custom Error subclass", () => new (class extends Error {})("Custom")],
  ])("responds to %s with 500", async (_name, errorToThrow) => {
    const app = createTestApp(errorToThrow)

    const response = await request(app).get("/test")

    expect(response.status).toBe(500)
    expect(response.body.errorMessages).toHaveLength(1)
  })

  // Express middleware attaches a status to the errors it raises, and so does
  // `RenderingError`; a client mistake must not be reported as a server failure.
  test.each([
    ["status", { status: 400 }, 400],
    ["statusCode", { statusCode: 413 }, 413],
    ["status ahead of statusCode", { status: 422, statusCode: 500 }, 422],
  ])(
    "honours the 4xx %s carried by the error",
    async (_description, properties, expectedStatus) => {
      const app = createTestApp(() =>
        Object.assign(new Error("Client mistake"), properties)
      )

      const response = await request(app).get("/test")

      expect(response.status).toBe(expectedStatus)
      expect(response.body).toStrictEqual({
        errorMessages: ["Client mistake"],
      })
    }
  )

  test.each([
    ["a 5xx status", { status: 502 }],
    ["a 3xx status", { status: 302 }],
    ["a status that is not a number", { status: "400" }],
  ])(
    "responds with 500 when the error carries %s",
    async (_name, properties) => {
      const app = createTestApp(() =>
        Object.assign(new Error("Not a client mistake"), properties)
      )

      const response = await request(app).get("/test")

      expect(response.status).toBe(500)
      expect(response.body).toStrictEqual({
        errorMessages: ["Not a client mistake"],
      })
    }
  )

  test("responds with 500 and an empty message when the error has none", async () => {
    const app = createTestApp(() => new Error())

    const response = await request(app).get("/test")

    expect(response.status).toBe(500)
    expect(response.body).toStrictEqual({ errorMessages: [""] })
  })

  test("does not leak the stack trace to the client", async () => {
    const app = createTestApp(() => new Error("Something went wrong"))

    const response = await request(app).get("/test")

    expect(response.text).not.toContain("ErrorHandler.test")
    expect(response.text).not.toContain("at ")
  })
})
