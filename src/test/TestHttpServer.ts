import http, { Server } from "node:http"
import { AddressInfo } from "node:net"

/**
 * A throwaway HTTP server used by the rendering tests so that they exercise a
 * real Chromium against local fixtures instead of the public internet.
 */
export type TestHttpServer = {
  readonly url: string
  readonly port: number
  /** The paths of every request the server has received, in order. */
  readonly requests: string[]
  urlFor(path: string): string
  close(): Promise<void>
}

/** A page is either its HTML or a redirect to another URL. */
export type Fixture = string | { redirectTo: string }

/**
 * A page is either its HTML or a function of the port the server ended up
 * listening on, for fixtures that need to refer back to the server.
 */
export type FixtureFactory = Fixture | ((port: number) => Fixture)

export const startTestHttpServer = (
  pages: Record<string, FixtureFactory>
): Promise<TestHttpServer> =>
  new Promise((resolve) => {
    const requests: string[] = []

    const server: Server = http.createServer((request, response) => {
      const { pathname } = new URL(request.url ?? "/", "http://localhost")
      const { port } = server.address() as AddressInfo
      const factory = pages[pathname]
      const page = typeof factory === "function" ? factory(port) : factory

      requests.push(pathname)

      if (page === undefined) {
        response.writeHead(404, { "Content-Type": "text/plain" })
        response.end("Not Found")
      } else if (typeof page === "string") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        response.end(page)
      } else {
        response.writeHead(302, { Location: page.redirectTo })
        response.end()
      }
    })

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo
      const url = `http://127.0.0.1:${port}`

      resolve({
        url,
        port,
        requests,
        urlFor: (path: string) => `${url}${path}`,
        close: () =>
          new Promise((closed, failed) => {
            server.close((error) => (error ? failed(error) : closed()))
          }),
      })
    })
  })

/** A page whose `.deferred` element is only added to the DOM after a delay. */
export const deferredContentPage = (delayMilliseconds: number): string => `
<!doctype html>
<html lang="en">
  <head><title>Deferred</title></head>
  <body>
    <div id="immediate">Immediate</div>
    <div id="container"></div>
    <script>
      setTimeout(() => {
        const element = document.createElement("div")
        element.className = "deferred"
        element.textContent = "Deferred"
        document.getElementById("container").appendChild(element)
      }, ${delayMilliseconds})
    </script>
  </body>
</html>
`

export const staticPage = `
<!doctype html>
<html lang="en">
  <head><title>Static</title></head>
  <body>
    <h1 id="heading">Static heading</h1>
    <p class="paragraph">Static paragraph</p>
  </body>
</html>
`

/**
 * A page that requests `url` from a script and then marks itself `.done`,
 * whether or not the request succeeded.
 */
export const fetchingPage = (url: string): string => `
<!doctype html>
<html lang="en">
  <head><title>Fetching</title></head>
  <body>
    <div id="status">Fetching</div>
    <script>
      fetch(${JSON.stringify(url)}, { mode: "no-cors" })
        .catch(() => {})
        .finally(() => {
          document.getElementById("status").className = "done"
        })
    </script>
  </body>
</html>
`

/** A page whose only image is a 1x1 GIF embedded as a `data:` URL. */
export const inlineImagePage = `
<!doctype html>
<html lang="en">
  <head><title>Inline image</title></head>
  <body>
    <img id="pixel" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
  </body>
</html>
`
