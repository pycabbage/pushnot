import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { factory } from "../env"

const pushSchema = z.object({})
export const push = factory.createApp().post("/", zValidator("json", pushSchema), async () => {})
