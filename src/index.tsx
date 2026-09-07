import { Hono } from "hono"
import App from "./client/App"
import { renderPage } from "./renderer"

const app = new Hono()

app.get("/", async (c) => {
  c.header("Content-Type", "text/html; charset=UTF-8")
  return c.body(await renderPage(<App />))
})

export default app
