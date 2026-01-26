import request from "supertest"
import express, { Express, Request, Response, NextFunction } from "express"
import errorHandler from "./ErrorHandler"
import { z } from "zod/v4"

describe("ErrorHandler middleware", () => {
  const createTestApp = (errorToThrow: () => Error): Express => {
    const app = express()
    app.get("/test", (req: Request, res: Response, next: NextFunction) => {
      next(errorToThrow())
    })
    app.use(errorHandler)
    return app
  }

  test("handles ZodError with proper format", async () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })
    if (result.success) {
      throw new Error("Expected parsing to fail")
    }

    const app = createTestApp(() => result.error)

    const response = await request(app).get("/test")

    expect(response.status).toBe(400)
    expect(response.body.errorMessage).toBeDefined()
    expect(Array.isArray(response.body.errorMessage)).toBe(true)
  })

  test("handles generic Error with 500 status", async () => {
    const app = createTestApp(() => new Error("Something went wrong"))

    const response = await request(app).get("/test")

    expect(response.status).toBe(500)
    expect(response.body.errorMessage).toEqual(["Something went wrong"])
  })
})
