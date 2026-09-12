import { gracefulShutdown } from "./Shutdown"

describe("gracefulShutdown", () => {
  type CloseCallback = (error?: Error) => void

  let closeCallbacks: CloseCallback[]
  let server: { close: jest.Mock }
  let exit: jest.Mock

  const createShutdown = (gracePeriodMs = 1_000): (() => void) =>
    gracefulShutdown(server, gracePeriodMs, exit)

  beforeEach(() => {
    jest.useFakeTimers()

    closeCallbacks = []
    server = {
      close: jest.fn((callback: CloseCallback) => {
        closeCallbacks.push(callback)
      }),
    }
    exit = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("stops the server accepting connections", () => {
    createShutdown()()

    expect(server.close).toHaveBeenCalledTimes(1)
  })

  test("closes the server only once however many signals arrive", () => {
    const shutdown = createShutdown()

    shutdown()
    shutdown()

    expect(server.close).toHaveBeenCalledTimes(1)
  })

  test("lets the process end naturally once the server has closed in time", () => {
    createShutdown(1_000)()

    jest.advanceTimersByTime(500)
    closeCallbacks[0]()
    jest.advanceTimersByTime(1_000)

    expect(exit).not.toHaveBeenCalled()
  })

  test("forces the process to exit when the server does not close in time", () => {
    createShutdown(1_000)()

    jest.advanceTimersByTime(999)
    expect(exit).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(exit).toHaveBeenCalledWith(1)
  })

  test("still exits when closing the server fails", () => {
    createShutdown(1_000)()

    closeCallbacks[0](new Error("Server is not running"))

    expect(exit).toHaveBeenCalledWith(1)
  })
})
