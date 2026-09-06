import { Clock } from "../utils/Clock"

/** A clock that always reports the same instant, for deterministic output. */
export const fixedClock = (
  timestamp: string = "2024-01-01T00:00:00.000Z"
): Clock => ({
  timestamp: () => new Date(timestamp),
})
