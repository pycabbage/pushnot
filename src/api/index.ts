import { factory } from "../env"
import { notifications } from "./notifications"
import { push } from "./push"
import { register } from "./register"
import { unregister } from "./unregister"

export const api = factory
  .createApp()
  .route("/register", register)
  .route("/unregister", unregister)
  .route("/notifications", notifications)
  .route("/push", push)
