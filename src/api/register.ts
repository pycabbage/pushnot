import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { factory } from "../env"

const registerSchema = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export const register = factory
  .createApp()
  .post("/", zValidator("json", registerSchema), async (c) => {
    const { endpoint, keys } = c.req.valid("json")
    const stub = c.env.SESSION_DO.getByName(c.var.sessionId)
    await stub.register({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
    return c.json({ ok: true })
  })
