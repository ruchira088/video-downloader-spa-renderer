import { z } from "zod"

/** How much of the container a render may use; see `RenderingOptions`. */
export const RenderingConfiguration = z.object({
  renderTimeoutMs: z.coerce.number().int().positive(),
  maxConcurrentRenders: z.coerce.number().int().positive(),
  maxQueuedRenders: z.coerce.number().int().nonnegative(),
  /**
   * HTTP proxy Chromium sends all page traffic through. Sites such as SxyPrn
   * sign their video URLs for the IP that rendered the page, so this must be
   * the same proxy the back-end downloads through.
   */
  proxyUrl: z.url({ protocol: /^https?$/u }).optional(),
})

export type RenderingConfiguration = z.infer<typeof RenderingConfiguration>
