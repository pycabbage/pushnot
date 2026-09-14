import { createFactory } from "hono/factory"
import type { JwtVariables } from "hono/jwt"

export interface Env {
  Bindings: CloudflareBindings
  Variables: JwtVariables & {
    sessionId: string
  }
}

export const factory = createFactory<Env>()
