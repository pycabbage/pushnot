import { env } from "cloudflare:workers"

import { QR } from "@/components/qr"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { URLBox } from "@/components/url-box"

import type { Env } from "../env"
import AppClient from "./AppClient"

interface AppProps {
  vars: Env["Variables"]
  url: string
}
export default async function App({ vars, url }: AppProps) {
  const stub = env.SESSION_DO.getByName(vars.sessionId)
  const isRegistered = await stub.hasSubscribers()
  const joinURL = new URL(url)
  joinURL.searchParams.set("join", vars.jwtPayload)

  return (
    <>
      <h1 className="">pushnot</h1>
      <p className="">Notification delivery for agents.</p>
      <AppClient
        sessionId={vars.sessionId}
        vapidPublicKey={env.VAPID_PUBLIC_KEY}
        initialRegistered={isRegistered}
      />
      <Dialog>
        <DialogTrigger render={<Button>Add other device</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add other device</DialogTitle>
          </DialogHeader>
          <URLBox url={joinURL.toString()} />
          <QR className="aspect-square size-48" url={joinURL.toString()} />
        </DialogContent>
      </Dialog>
    </>
  )
}
