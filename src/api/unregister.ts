import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { factory } from "../env"

const unregisterSchema = z.object({
  endpoint: z.url(),
})

export const unregister = factory
  .createApp()
  .post("/", zValidator("json", unregisterSchema), async (c) => {
    const { endpoint } = c.req.valid("json")
    const stub = c.env.SESSION_DO.getByName(c.var.sessionId)
    await stub.unregister(endpoint)
    return c.json({ ok: true })
  })
