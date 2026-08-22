import { Writable } from "node:stream"
import { Logger, transports } from "winston"
import { create } from "./Logger"

describe("Logger", () => {
  const captureLogOutput = async (
    name: string,
    log: (logger: Logger) => void
  ): Promise<string> => {
    const lines: string[] = []
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString())
        callback()
      },
    })

    const logger = create(name)
    logger.clear()
    logger.add(new transports.Stream({ stream }))

    log(logger)

    await new Promise((resolve) => {
      setImmediate(resolve)
    })

    return lines.join("")
  }

  test("labels the output with the basename of the supplied path", async () => {
    const output = await captureLogOutput(
      "/app/src/services/Widget.ts",
      (logger) => logger.info("Rendering started")
    )

    expect(output).toContain("Widget.ts")
    expect(output).not.toContain("/app/src/services")
  })

  test("formats entries as timestamp, label, upper case level and message", async () => {
    const output = await captureLogOutput("/app/src/main.ts", (logger) =>
      logger.info("Server started")
    )

    expect(output.trim()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z main\.ts {2}INFO\tServer started$/u
    )
  })

  test("emits warnings and errors", async () => {
    const output = await captureLogOutput("/app/src/main.ts", (logger) => {
      logger.warn("Health check failed")
      logger.error("Boom")
    })

    expect(output).toContain("WARN\tHealth check failed")
    expect(output).toContain("ERROR\tBoom")
  })

  test("does not emit entries below the info level", async () => {
    const output = await captureLogOutput("/app/src/main.ts", (logger) =>
      logger.debug("Noisy detail")
    )

    expect(output).toBe("")
  })
})
