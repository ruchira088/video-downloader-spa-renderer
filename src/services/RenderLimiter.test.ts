import { RenderLimiter } from "./RenderLimiter"
import { RendererBusyError } from "./RendererBusyError"

/** A task whose completion the test controls. */
const deferred = <A>() => {
  let resolve!: (value: A) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<A>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const neverAborted = (): AbortSignal => new AbortController().signal

// Lets the microtasks that hand a released slot to the next waiter run.
const settle = () =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })

describe("RenderLimiter", () => {
  test("runs a task straight away while a slot is free", async () => {
    const limiter = new RenderLimiter(1, 0)

    await expect(
      limiter.run(() => Promise.resolve("done"), neverAborted())
    ).resolves.toBe("done")
  })

  test("never runs more tasks at once than it has slots", async () => {
    const limiter = new RenderLimiter(2, 10)
    const tasks = [
      deferred<void>(),
      deferred<void>(),
      deferred<void>(),
      deferred<void>(),
    ]
    let running = 0
    let peak = 0

    const results = tasks.map((task) =>
      limiter.run(async () => {
        running++
        peak = Math.max(peak, running)
        await task.promise
        running--
      }, neverAborted())
    )

    for (const task of tasks) {
      await settle()
      task.resolve()
    }

    await Promise.all(results)

    expect(peak).toBe(2)
  })

  test("starts queued tasks in the order they arrived", async () => {
    const limiter = new RenderLimiter(1, 10)
    const first = deferred<void>()
    const started: string[] = []

    const results = [
      limiter.run(() => first.promise, neverAborted()),
      limiter.run(() => {
        started.push("second")
        return Promise.resolve()
      }, neverAborted()),
      limiter.run(() => {
        started.push("third")
        return Promise.resolve()
      }, neverAborted()),
    ]

    first.resolve()
    await Promise.all(results)

    expect(started).toEqual(["second", "third"])
  })

  test("frees the slot when a task fails", async () => {
    const limiter = new RenderLimiter(1, 1)
    const failure = new Error("Render failed")

    await expect(
      limiter.run(() => Promise.reject(failure), neverAborted())
    ).rejects.toBe(failure)

    await expect(
      limiter.run(() => Promise.resolve("next"), neverAborted())
    ).resolves.toBe("next")
  })

  test("rejects with a RendererBusyError once the queue is full", async () => {
    const limiter = new RenderLimiter(1, 1)
    const blocker = deferred<void>()

    const running = limiter.run(() => blocker.promise, neverAborted())
    const queued = limiter.run(() => Promise.resolve("queued"), neverAborted())

    await expect(
      limiter.run(() => Promise.resolve("rejected"), neverAborted())
    ).rejects.toBeInstanceOf(RendererBusyError)

    blocker.resolve()
    await expect(running).resolves.toBeUndefined()
    await expect(queued).resolves.toBe("queued")
  })

  test("rejects straight away when every slot is busy and queueing is disabled", async () => {
    const limiter = new RenderLimiter(1, 0)
    const blocker = deferred<void>()

    const running = limiter.run(() => blocker.promise, neverAborted())

    await expect(
      limiter.run(() => Promise.resolve("rejected"), neverAborted())
    ).rejects.toBeInstanceOf(RendererBusyError)

    blocker.resolve()
    await running
  })

  test("drops a queued task whose signal aborts, without running it", async () => {
    const limiter = new RenderLimiter(1, 1)
    const blocker = deferred<void>()
    const controller = new AbortController()
    const reason = new Error("Gave up")
    const abandoned = jest.fn()

    const running = limiter.run(() => blocker.promise, neverAborted())
    const queued = limiter.run(abandoned, controller.signal)

    controller.abort(reason)
    await expect(queued).rejects.toBe(reason)

    // The abandoned task no longer holds its place in the queue.
    const replacement = limiter.run(
      () => Promise.resolve("replacement"),
      neverAborted()
    )

    blocker.resolve()
    await running

    await expect(replacement).resolves.toBe("replacement")
    expect(abandoned).not.toHaveBeenCalled()
  })

  test("rejects without running the task when the signal has already aborted", async () => {
    const limiter = new RenderLimiter(1, 1)
    const reason = new Error("Too late")
    const task = jest.fn()

    await expect(limiter.run(task, AbortSignal.abort(reason))).rejects.toBe(
      reason
    )
    expect(task).not.toHaveBeenCalled()
  })
})
