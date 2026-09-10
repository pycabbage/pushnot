import { env } from "cloudflare:workers"

import type { Env } from "../env"
import AppClient from "./AppClient"

export default async function App({ vars }: { vars: Env["Variables"] }) {
  const stub = env.SESSION_DO.getByName(vars.sessionId)
  const isRegistered = await stub.hasSubscribers()

  return (
    <AppClient
      sessionId={vars.sessionId}
      vapidPublicKey={env.VAPID_PUBLIC_KEY}
      initialRegistered={isRegistered}
    />
  )
}
