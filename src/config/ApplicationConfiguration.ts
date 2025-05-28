import {httpConfiguration, HttpConfiguration} from "./HttpConfiguration"
import {BuildInformation, serviceInformation} from "./BuildInformation"
import {z} from "zod/v4"

export const ApplicationConfiguration = z.object({
    httpConfiguration: HttpConfiguration,
    serviceInformation: BuildInformation
})

export type ApplicationConfiguration = z.infer<typeof ApplicationConfiguration>

export const createApplicationConfiguration =
    (env: NodeJS.Dict<string>): ApplicationConfiguration =>
        ({httpConfiguration: httpConfiguration(env), serviceInformation: serviceInformation(env)})