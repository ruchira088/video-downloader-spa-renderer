import request from "supertest"
import {httpApplication} from "./app"
import {HEALTH_CHECK_READY_CSS_SELECTORS, HEALTH_CHECK_URL} from "./services/HealthService"
import {defaultClock} from "./utils/Clock"
import {applicationConfiguration} from "./config/ApplicationConfiguration"
import {launchBrowser} from "./services/RenderingService"
import jsdom from "jsdom"

describe("Testing HTTP application", () => {
    it("Retrieving the HTML markup of the health check SPA service", async () => {
        const browser = await launchBrowser()
        const app = await httpApplication(browser, defaultClock, applicationConfiguration(process.env))

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
})