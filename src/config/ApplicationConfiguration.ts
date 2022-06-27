import {httpConfiguration, HttpConfiguration} from "./HttpConfiguration"
import {serviceInformation, BuildInformation} from "./BuildInformation"

export interface ApplicationConfiguration {
    readonly httpConfiguration: HttpConfiguration
    readonly serviceInformation: BuildInformation
}

export const applicationConfiguration = (env: NodeJS.ProcessEnv) => ({
    httpConfiguration: httpConfiguration(env),
    serviceInformation: serviceInformation(env)
})