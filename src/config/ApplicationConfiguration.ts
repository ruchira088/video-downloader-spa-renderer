import {HttpConfiguration} from "./HttpConfiguration"
import {BuildInformation} from "./BuildInformation"
import {z} from "zod/v4"

export const ApplicationConfiguration = z.object({
  httpConfiguration: HttpConfiguration,
  buildInformation: BuildInformation,
})

export type ApplicationConfiguration = z.infer<typeof ApplicationConfiguration>