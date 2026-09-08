import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { factory } from "../env"

// PushSubscription.toJSON()が返す標準的な形状
// note: zod v4では `.url()` は非推奨のため、代わりにトップレベルの `z.url()` を使用する
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
    console.log(`Registered client: ${endpoint}`)
    return c.json({ ok: true })
  })
