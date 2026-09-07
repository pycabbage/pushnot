import { createFactory } from "hono/factory"

export type Env = {
  Bindings: CloudflareBindings
  Variables: {
    // session information
    sessionId: string
  }
}

export const factory = createFactory<Env>()
