import { Hono } from "hono"
import { session } from "./middleware/session"
import App from "./client/App"
import { renderer } from "./renderer"
import { api } from "./api"
import { Env } from "./env"

const app = new Hono<Env>()
  .use(renderer)
  .use(session)
  .get("/", (c) => {
    return c.render(<App />)
  })
  .route("/api", api)

export { SessionDO } from "./do/session"
export type AppType = typeof app
export default app
