import request from "supertest"
import express, { Express } from "express"
import notFoundHandler from "./NotFoundHandler"

describe("NotFoundHandler middleware", () => {
  const createTestApp = (): Express => {
    const app = express()
    app.use(notFoundHandler)
    return app
  }

  test("returns 404 with error message for unknown routes", async () => {
    const app = createTestApp()

    const response = await request(app).get("/unknown-route")

    expect(response.status).toBe(404)
    expect(response.body.errorMessage).toEqual([
      "Endpoint not found at /unknown-route",
    ])
  })

  test("includes original URL in error message", async () => {
    const app = createTestApp()

    const response = await request(app).get("/some/nested/path?query=value")

    expect(response.status).toBe(404)
    expect(response.body.errorMessage).toEqual([
      "Endpoint not found at /some/nested/path?query=value",
    ])
  })
})
