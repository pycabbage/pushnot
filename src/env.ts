import { createFactory } from "hono/factory"

export type Env = {
  Bindings: CloudflareBindings
  Variables: {
    // session information
  }
}

export const factory = createFactory<Env>()
