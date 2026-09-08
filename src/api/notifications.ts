import { factory } from "../env"

export const notifications = factory.createApp().get("/", async (c) => {
  const stub = c.env.SESSION_DO.getByName(c.var.sessionId)
  const rows = await stub.listNotifications()
  return c.json(rows)
})
