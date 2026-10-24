import { z } from "zod"

/** How much of the container a render may use; see `RenderingOptions`. */
export const RenderingConfiguration = z.object({
  renderTimeoutMs: z.coerce.number().int().positive(),
  maxConcurrentRenders: z.coerce.number().int().positive(),
  maxQueuedRenders: z.coerce.number().int().nonnegative(),
})

export type RenderingConfiguration = z.infer<typeof RenderingConfiguration>
