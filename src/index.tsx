import { Hono } from "hono"

import { api } from "./api"
import App from "./app/App"
import { Env } from "./env"
import { renderer } from "./middleware/renderer"
import { session } from "./middleware/session"

const app = new Hono<Env>()
  .use(renderer)
  .use(session)
  .get("/", (c) => c.render(<App vars={c.var} />))
  .route("/api", api)

export { SessionDO } from "./do/session"
export type AppType = typeof app
export default app
