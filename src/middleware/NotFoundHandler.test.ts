import request from "supertest"
import express, { Express } from "express"
import notFoundHandler from "./NotFoundHandler"

describe("NotFoundHandler middleware", () => {
  const createTestApp = (): Express => express().use(notFoundHandler)

  test("returns 404 with an error message for unknown routes", async () => {
    const response = await request(createTestApp()).get("/unknown-route")

    expect(response.status).toBe(404)
    expect(response.headers["content-type"]).toMatch(/application\/json/u)
    expect(response.body).toStrictEqual({
      errorMessages: ["Endpoint not found at /unknown-route"],
    })
  })

  test("includes the query string in the error message", async () => {
    const response = await request(createTestApp()).get(
      "/some/nested/path?query=value"
    )

    expect(response.status).toBe(404)
    expect(response.body.errorMessages).toEqual([
      "Endpoint not found at /some/nested/path?query=value",
    ])
  })

  test.each(["get", "post", "put", "patch", "delete"] as const)(
    "handles %s requests",
    async (method) => {
      const response = await request(createTestApp())[method]("/unknown-route")

      expect(response.status).toBe(404)
      expect(response.body.errorMessages).toEqual([
        "Endpoint not found at /unknown-route",
      ])
    }
  )
})
