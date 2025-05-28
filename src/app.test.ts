import request from "supertest"
import {createHttpApplication} from "./app"
import {HEALTH_CHECK_READY_CSS_SELECTORS, HEALTH_CHECK_URL} from "./services/HealthService"
import {defaultClock} from "./utils/Clock"
import {createApplicationConfiguration} from "./config/ApplicationConfiguration"
import {launchBrowser} from "./services/RenderingService"
import jsdom from "jsdom"
import {Browser, Page} from "puppeteer"

describe("Testing HTTP application", () => {
    test("Retrieving the HTML markup of the health check SPA service", async () => {
        const browser = await launchBrowser()
        const app = await createHttpApplication(browser, defaultClock, createApplicationConfiguration(process.env))

        const response =
            await request(app)
                .post("/render")
                .send({url: HEALTH_CHECK_URL, readyCssSelectors: HEALTH_CHECK_READY_CSS_SELECTORS})

        await browser.close()

        expect(response.status).toBe(200)

        const {document} = new jsdom.JSDOM(response.text).window

        expect(document.getElementById("text-field")?.textContent).toBe("ID specified")
        expect(document.querySelector(".class-name")?.textContent).toBe("Class specified")
        expect(document.querySelector(".deferred-class-name")?.textContent).toBe("Hello World")
        expect(document.getElementById("build-timestamp")).toBeTruthy()
    })

    test("Returns request body validation error messages", async () => {
        const browser: Browser = {newPage: jest.fn() as () => Promise<Page>} as Browser
        const app = await createHttpApplication(browser, defaultClock, createApplicationConfiguration(process.env))

        const response =
            await request(app)
                .post("/render")
                .send({readyCssSelectors: HEALTH_CHECK_READY_CSS_SELECTORS})

        expect(browser.newPage).not.toHaveBeenCalled()

        expect(response.status).toBe(400)
        expect(response.body).toStrictEqual({
            errorMessage: [{
                code: "invalid_type",
                expected: "string",
                message: "Required",
                path: ["url"],
                received: "undefined"
            }]
        })
    })
})