import { factory } from "../env"
import { notifications } from "./notifications"
import { push } from "./push"
import { register } from "./register"
import { unregister } from "./unregister"

export const api = factory
  .createApp()
  .use(async (c, next) => {
    const { success } = await c.env.RATE_LIMIT.limit({
      key: c.req.header("cf-connecting-ip") || "",
    })
    if (!success) {
      return c.text("Rate limit exceeded", 429)
    }
    return next()
  })
  .route("/register", register)
  .route("/unregister", unregister)
  .route("/notifications", notifications)
  .route("/push", push)
