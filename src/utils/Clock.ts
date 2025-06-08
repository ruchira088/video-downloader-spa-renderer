export interface Clock {
  timestamp(): Date
}

export const defaultClock: Clock = {
  timestamp(): Date {
    return new Date()
  },
}
