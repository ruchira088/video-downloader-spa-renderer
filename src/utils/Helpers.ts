export type Optional<T> = T | undefined | null

export const map =
    <A, B>(value: A | undefined | null, fn: (value: A) => B): B | undefined | null => {
        if (value !== null && value !== undefined) {
            return fn(value)
        } else {
            return value as undefined | null
        }
    }

export const filter =
    <A>(value: A | undefined | null, fn: (value: A) => boolean): A | undefined | null => {
        if (value === null || value === undefined) {
            return value as undefined | null
        } else if (fn(value)) {
            return value
        } else {
            return null
        }
    }
