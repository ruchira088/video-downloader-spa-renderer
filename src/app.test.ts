import request from "supertest"
import {HEALTH_CHECK_READY_CSS_SELECTORS, HEALTH_CHECK_URL} from "./services/HealthService"
import jsdom from "jsdom"
import {createExpressApp} from "./app"
import {createApplicationConfiguration} from "./config/ApplicationConfiguration"

describe("Testing HTTP application", () => {
    test("Retrieving the HTML markup of the health check SPA service", async () => {
        const app = createExpressApp(createApplicationConfiguration(process.env))

        const response =
            await request(app)
                .post("/render")
                .send({url: HEALTH_CHECK_URL, readyCssSelectors: HEALTH_CHECK_READY_CSS_SELECTORS})

        expect(response.status).toBe(200)

        const {document} = new jsdom.JSDOM(response.text).window

        expect(document.getElementById("text-field")?.textContent).toBe("ID specified")
        expect(document.querySelector(".class-name")?.textContent).toBe("Class specified")
        expect(document.querySelector(".deferred-class-name")?.textContent).toBe("Hello World")
        expect(document.getElementById("build-timestamp")).toBeTruthy()
    })

    test("Returns request body validation error messages", async () => {
        const app = createExpressApp(createApplicationConfiguration(process.env))

        const response =
            await request(app)
                .post("/render")
                .send({readyCssSelectors: HEALTH_CHECK_READY_CSS_SELECTORS})

        expect(response.status).toBe(400)
        expect(response.body).toStrictEqual({
            errorMessage: [{
                code: "invalid_type",
                expected: "string",
                message: "Invalid input: expected string, received undefined",
                path: [ "url" ]
            }]
        })
    })
})