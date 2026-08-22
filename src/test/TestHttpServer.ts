import http, { Server } from "node:http"
import { AddressInfo } from "node:net"

/**
 * A throwaway HTTP server used by the rendering tests so that they exercise a
 * real Chromium against local fixtures instead of the public internet.
 */
export type TestHttpServer = {
  readonly url: string
  urlFor(path: string): string
  close(): Promise<void>
}

export const startTestHttpServer = (
  pages: Record<string, string>
): Promise<TestHttpServer> =>
  new Promise((resolve) => {
    const server: Server = http.createServer((request, response) => {
      const { pathname } = new URL(request.url ?? "/", "http://localhost")
      const page = pages[pathname]

      if (page === undefined) {
        response.writeHead(404, { "Content-Type": "text/plain" })
        response.end("Not Found")
      } else {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        response.end(page)
      }
    })

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo
      const url = `http://127.0.0.1:${port}`

      resolve({
        url,
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
