import { factory } from "../env"
import { register } from "./register"
import { push } from "./push"

export const api = factory.createApp().route("/register", register).route("/push", push)
