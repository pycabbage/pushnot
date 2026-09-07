import { createMiddleware } from "hono/factory"
import type { Env } from "../env"

export const session = createMiddleware<Env>(async (_c, next) => {
  return next()
})
