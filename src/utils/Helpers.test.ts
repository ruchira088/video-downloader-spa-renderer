import { abortable, errorMessage, withTimeout } from "./Helpers"

describe("Helpers", () => {
  describe("errorMessage", () => {
    test("returns the message of an Error", () => {
      expect(errorMessage(new Error("Boom"))).toBe("Boom")
    })

    test("returns the message of an Error subclass", () => {
      expect(errorMessage(new TypeError("Not a function"))).toBe(
        "Not a function"
      )
    })

    test.each([
      ["a string", "connection dropped", "connection dropped"],
      ["a number", 42, "42"],
      ["null", null, "null"],
      ["undefined", undefined, "undefined"],
      ["an object", { code: 1 }, "[object Object]"],
    ])("describes %s that was thrown", (_description, thrown, expected) => {
      expect(errorMessage(thrown)).toBe(expected)
    })
  })

  describe("withTimeout", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    const never = new Promise<string>(() => {
      /* never settles */
    })

    const after = <A>(milliseconds: number, value: A): Promise<A> =>
      new Promise((resolve) => {
        setTimeout(() => resolve(value), milliseconds)
      })

    test("returns the value when the promise settles first", async () => {
      await expect(
        withTimeout(() => Promise.resolve("value"), 1_000)
      ).resolves.toBe("value")
    })

    test("rejects when the timeout elapses first", async () => {
      const assertion = expect(withTimeout(() => never, 1_000)).rejects.toThrow(
        "Timed out after 1000ms"
      )

      await jest.advanceTimersByTimeAsync(1_000)

      await assertion
    })

    test("returns the value when the promise settles just before the timeout", async () => {
      const result = withTimeout(() => after(999, "value"), 1_000)

      await jest.advanceTimersByTimeAsync(1_000)

      await expect(result).resolves.toBe("value")
    })

    test("propagates a rejection rather than timing out", async () => {
      await expect(
        withTimeout(() => Promise.reject(new Error("Boom")), 1_000)
      ).rejects.toThrow("Boom")
    })

    test("clears the timer once the promise settles", async () => {
      await withTimeout(() => Promise.resolve("value"), 1_000)

      expect(jest.getTimerCount()).toBe(0)
    })

    test("keeps the timer running until the promise settles", () => {
      withTimeout(() => never, 1_000).catch(() => {
        /* the rejection is expected */
      })

      expect(jest.getTimerCount()).toBe(1)
    })
    test("aborts the signal it hands to the work once the timeout elapses", async () => {
      let received: AbortSignal | undefined

      const result = withTimeout((signal) => {
        received = signal
        return never
      }, 1_000).catch((error: unknown) => error)

      expect(received?.aborted).toBe(false)

      await jest.advanceTimersByTimeAsync(1_000)

      expect(received?.aborted).toBe(true)
      expect(received?.reason).toBe(await result)
    })

    test("leaves the signal alone when the work finishes in time", async () => {
      let received: AbortSignal | undefined

      await withTimeout((signal) => {
        received = signal
        return Promise.resolve("value")
      }, 1_000)

      expect(received?.aborted).toBe(false)
    })
  })

  describe("abortable", () => {
    const never = new Promise<string>(() => {
      /* never settles */
    })

    test("settles with the promise while the signal stays quiet", async () => {
      const signal = new AbortController().signal

      await expect(abortable(Promise.resolve("value"), signal)).resolves.toBe(
        "value"
      )
      await expect(
        abortable(Promise.reject(new Error("Boom")), signal)
      ).rejects.toThrow("Boom")
    })

    test("rejects with the abort reason as soon as the signal aborts", async () => {
      const controller = new AbortController()
      const reason = new Error("Deadline")

      const result = abortable(never, controller.signal)
      controller.abort(reason)

      await expect(result).rejects.toBe(reason)
    })

    test("rejects straight away when the signal has already aborted", async () => {
      const reason = new Error("Too late")

      await expect(abortable(never, AbortSignal.abort(reason))).rejects.toBe(
        reason
      )
    })

    test("swallows a later rejection of the abandoned promise", async () => {
      const controller = new AbortController()
      let rejectLater!: (reason: unknown) => void
      const abandoned = new Promise<string>((_resolve, reject) => {
        rejectLater = reject
      })
      const unhandled = jest.fn()
      process.on("unhandledRejection", unhandled)

      const result = abortable(abandoned, controller.signal)
      controller.abort(new Error("Deadline"))
      await expect(result).rejects.toThrow("Deadline")

      rejectLater(new Error("Target closed"))
      await new Promise((resolve) => {
        setImmediate(resolve)
      })

      process.off("unhandledRejection", unhandled)
      expect(unhandled).not.toHaveBeenCalled()
    })

    test("stops listening to the signal once the promise settles", async () => {
      const controller = new AbortController()
      const removeEventListener = jest.spyOn(
        controller.signal,
        "removeEventListener"
      )

      await abortable(Promise.resolve("value"), controller.signal)

      expect(removeEventListener).toHaveBeenCalledWith(
        "abort",
        expect.any(Function)
      )
    })
  })
})
