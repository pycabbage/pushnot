import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { factory } from "../env"

const registerSchema = z.object({})
export const register = factory
  .createApp()
  .post("/", zValidator("json", registerSchema), async () => {})
