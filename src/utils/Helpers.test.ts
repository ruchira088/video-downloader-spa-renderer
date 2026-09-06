import { errorMessage, withTimeout } from "./Helpers"

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
      await expect(withTimeout(Promise.resolve("value"), 1_000)).resolves.toBe(
        "value"
      )
    })

    test("rejects when the timeout elapses first", async () => {
      const assertion = expect(withTimeout(never, 1_000)).rejects.toThrow(
        "Timed out after 1000ms"
      )

      await jest.advanceTimersByTimeAsync(1_000)

      await assertion
    })

    test("returns the value when the promise settles just before the timeout", async () => {
      const result = withTimeout(after(999, "value"), 1_000)

      await jest.advanceTimersByTimeAsync(1_000)

      await expect(result).resolves.toBe("value")
    })

    test("propagates a rejection rather than timing out", async () => {
      await expect(
        withTimeout(Promise.reject(new Error("Boom")), 1_000)
      ).rejects.toThrow("Boom")
    })

    test("clears the timer once the promise settles", async () => {
      await withTimeout(Promise.resolve("value"), 1_000)

      expect(jest.getTimerCount()).toBe(0)
    })

    test("keeps the timer running until the promise settles", () => {
      withTimeout(never, 1_000).catch(() => {
        /* the rejection is expected */
      })

      expect(jest.getTimerCount()).toBe(1)
    })
  })
})
