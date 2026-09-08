import { factory } from "../env"
import { push } from "./push"
import { register } from "./register"

export const api = factory.createApp().route("/register", register).route("/push", push)
