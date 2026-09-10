import { createFactory } from "hono/factory"

export type Env = {
  Bindings: CloudflareBindings
  Variables: {
    sessionId: string
  }
}

export const factory = createFactory<Env>()
