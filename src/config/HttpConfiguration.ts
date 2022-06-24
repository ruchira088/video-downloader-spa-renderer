import {Maybe} from "monet"

export interface HttpConfiguration {
    readonly port: number
    readonly host: string
}

export const httpConfiguration = (env: NodeJS.ProcessEnv) => {
    const port: number = Maybe.fromNull(env.HTTP_PORT).map(stringValue => parseInt(stringValue, 10)).orJust(8000)
    const host: string = Maybe.fromNull(env.HTTP_HOST).orJust("0.0.0.0")

    return {port, host}
}