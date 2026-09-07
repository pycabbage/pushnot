import { factory } from "../env"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const pushSchema = z.object({})
export const push = factory.createApp().post("/", zValidator("json", pushSchema), async () => {})
