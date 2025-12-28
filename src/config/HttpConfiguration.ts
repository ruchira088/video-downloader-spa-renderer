import { z } from "zod/v4"

export const HttpConfiguration = z.object({
  port: z.coerce.number().int().positive(),
  host: z.ipv4(),
})

export type HttpConfiguration = z.infer<typeof HttpConfiguration>