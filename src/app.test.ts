import request from "supertest"
import {httpApplication} from "./app"
import {HEALTH_CHECK_READY_CSS_SELECTORS, HEALTH_CHECK_URL} from "./services/HealthService"
import {defaultClock} from "./utils/Clock"
import {applicationConfiguration} from "./config/ApplicationConfiguration"
import {launchBrowser} from "./services/RenderingService"

describe("Testing HTTP application", () => {
    it("Retrieving the HTML markup of the health check SPA service", async () => {
        const browser = await launchBrowser()
        const app = await httpApplication(browser, defaultClock, applicationConfiguration(process.env))

        const response =
            await request(app)
                .post("/render")
                .send({url: HEALTH_CHECK_URL, readyCssSelectors: HEALTH_CHECK_READY_CSS_SELECTORS})

        const expectedHead = `<meta charset="utf-8"><link rel="icon" href="/favicon.ico"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#000000"><meta name="description" content="SPA for the video-downloader-spa-renderer health check"><link rel="apple-touch-icon" href="/logo192.png"><title>React App</title>\x3Cscript defer="defer" src="/static/js/main.b7909c77.js">\x3C/script><link href="/static/css/main.7aa06142.css" rel="stylesheet">`
        const expectedBody = `<noscript>You need to enable JavaScript to run this app.</noscript><div id="root"><div id="app"><div class="header"><h1>Test Page</h1></div><div class="content"><div id="text-field">ID specified</div><div class="class-name">Class specified</div><div class="deferred-class-name">Hello World</div></div></div></div>`

        expect(response.status).toBe(200)
        expect(response.text).toBe(`<!DOCTYPE html><html lang="en"><head>${expectedHead}</head><body>${expectedBody}</body></html>`)

        await browser.close()
    })
})