import { factory } from "../env"
import { push } from "./push"
import { register } from "./register"
import { unregister } from "./unregister"

export const api = factory
  .createApp()
  .route("/register", register)
  .route("/unregister", unregister)
  .route("/push", push)
