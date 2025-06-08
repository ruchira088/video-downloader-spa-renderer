import { httpConfiguration, HttpConfiguration } from "./HttpConfiguration"
import { BuildInformation, buildInformation } from "./BuildInformation"
import { z } from "zod/v4"

export const ApplicationConfiguration = z.object({
  httpConfiguration: HttpConfiguration,
  buildInformation: BuildInformation,
})

export type ApplicationConfiguration = z.infer<typeof ApplicationConfiguration>

export const createApplicationConfiguration = (
  env: NodeJS.Dict<string>
): ApplicationConfiguration => ({
  httpConfiguration: httpConfiguration(env),
  buildInformation: buildInformation(env),
})
