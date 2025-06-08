import { z } from "zod/v4"
import { filter, map } from "../utils/Helpers"

export const HttpConfiguration = z.object({
  port: z.int(),
  host: z.ipv4(),
})

export type HttpConfiguration = z.infer<typeof HttpConfiguration>

export const httpConfiguration = (
  env: NodeJS.ProcessEnv
): HttpConfiguration => {
  const port: number =
    map(
      filter(env.HTTP_PORT?.trim(), (value) => value !== ""),
      (value) => parseInt(value, 10)
    ) ?? 8000

  const host: string =
    filter(env.HTTP_HOST?.trim(), (value) => value !== "") ?? "0.0.0.0"

  return HttpConfiguration.parse({ port, host })
}
