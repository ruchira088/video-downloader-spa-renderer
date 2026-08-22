import { filter, map, sleep, withTimeout } from "./Helpers"

describe("Helpers", () => {
  describe("map", () => {
    test("applies the function to a present value", () => {
      expect(map(2, (value) => value * 3)).toBe(6)
    })

    test("applies the function to falsy but present values", () => {
      expect(map(0, (value) => value + 1)).toBe(1)
      expect(map("", (value) => `${value}!`)).toBe("!")
      expect(map(false, (value) => !value)).toBe(true)
    })

    test.each([
      ["null", null],
      ["undefined", undefined],
    ])("passes %s through without calling the function", (_name, value) => {
      const fn = jest.fn()

      expect(map(value, fn)).toBe(value)
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe("filter", () => {
    test("returns the value when the predicate holds", () => {
      expect(filter("value", (input) => input.length > 0)).toBe("value")
    })

    test("returns null when the predicate fails", () => {
      expect(filter("", (input) => input.length > 0)).toBeNull()
    })

    test.each([
      ["null", null],
      ["undefined", undefined],
    ])("passes %s through without calling the predicate", (_name, value) => {
      const predicate = jest.fn()

      expect(filter(value, predicate)).toBe(value)
      expect(predicate).not.toHaveBeenCalled()
    })
  })

  describe("sleep", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test("resolves once the delay has elapsed", async () => {
      let resolved = false
      const sleeping = sleep(1_000).then(() => {
        resolved = true
      })

      await jest.advanceTimersByTimeAsync(999)
      expect(resolved).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await sleeping
      expect(resolved).toBe(true)
    })
  })

  describe("withTimeout", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test("returns the value when the promise settles first", async () => {
      const result = withTimeout(Promise.resolve("value"), 1_000, "fallback")

      await expect(result).resolves.toBe("value")
    })

    test("returns the fallback when the timeout elapses first", async () => {
      const result = withTimeout(
        new Promise<string>(() => {
          /* never settles */
        }),
        1_000,
        "fallback"
      )

      await jest.advanceTimersByTimeAsync(1_000)

      await expect(result).resolves.toBe("fallback")
    })

    test("returns the value when the promise settles just before the timeout", async () => {
      const result = withTimeout(
        sleep(999).then(() => "value"),
        1_000,
        "fallback"
      )

      await jest.advanceTimersByTimeAsync(1_000)

      await expect(result).resolves.toBe("value")
    })

    test("propagates a rejection rather than falling back", async () => {
      const result = withTimeout(
        Promise.reject(new Error("Boom")),
        1_000,
        "fallback"
      )

      await expect(result).rejects.toThrow("Boom")
    })
  })
})
