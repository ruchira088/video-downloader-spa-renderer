import { z } from "zod"

export const HealthCheckConfiguration = z.object({
  url: z.url(),
  readyCssSelectors: z.array(z.string()),
})

export type HealthCheckConfiguration = z.infer<typeof HealthCheckConfiguration>
