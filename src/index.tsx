import { Hono } from "hono"
import App from "./client/App"
import { renderer } from "./renderer"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use(renderer)

app.get("/", (c) => {
  return c.render(<App />)
})

export { ClientDO } from "./do/client"
export default app
