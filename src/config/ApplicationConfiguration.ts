import {httpConfiguration, HttpConfiguration} from "./HttpConfiguration"
import {serviceInformation, ServiceInformation} from "./ServiceInformation"

export interface ApplicationConfiguration {
    readonly httpConfiguration: HttpConfiguration
    readonly serviceInformation: ServiceInformation
}

export const applicationConfiguration = (env: NodeJS.ProcessEnv) => ({
    httpConfiguration: httpConfiguration(env),
    serviceInformation: serviceInformation(env)
})