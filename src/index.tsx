import { Hono } from "hono"

import { api } from "./api"
import App from "./client/App"
import { Env } from "./env"
import { renderer } from "./middleware/renderer"
import { session } from "./middleware/session"

const app = new Hono<Env>()
  .use(renderer)
  .use(session)
  .get("/", async (c) => {
    const stub = c.env.SESSION_DO.getByName(c.var.sessionId)
    const isRegistered = await stub.hasSubscribers()
    return c.render(
      <App
        data-session-id={c.var.sessionId}
        data-vapid-public-key={c.env.VAPID_PUBLIC_KEY}
        data-initial-registered={isRegistered}
      />
    )
  })
  .route("/api", api)

export { SessionDO } from "./do/session"
export type AppType = typeof app
export default app
