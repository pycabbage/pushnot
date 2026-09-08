import { factory } from "../env"

export const notifications = factory.createApp().get("/ws", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426)
  }

  const stub = c.env.SESSION_DO.getByName(c.var.sessionId)
  return stub.fetch(c.req.raw)
})
