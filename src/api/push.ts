import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { factory } from "../env"

export const pushSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
})

export const push = factory
  .createApp()
  .post("/:sessionId", zValidator("json", pushSchema), async (c) => {
    const sessionId = c.req.param("sessionId")
    const payload = c.req.valid("json")

    const stub = c.env.SESSION_DO.getByName(sessionId)
    const result = await stub.push(payload)

    return c.json(result)
  })
