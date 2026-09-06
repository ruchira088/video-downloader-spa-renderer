import { HttpConfiguration } from "./HttpConfiguration"
import { BuildInformation } from "./BuildInformation"
import { HealthCheckConfiguration } from "./HealthCheckConfiguration"
import { z } from "zod"

export const ApplicationConfiguration = z.object({
  httpConfiguration: HttpConfiguration,
  buildInformation: BuildInformation,
  healthCheckConfiguration: HealthCheckConfiguration,
})

export type ApplicationConfiguration = z.infer<typeof ApplicationConfiguration>
