import { hc } from "hono/client"
import { useState, useTransition } from "react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"

import type { AppType } from ".."

const client = hc<AppType>("/")

/**
 * base64url形式の文字列をUint8Arrayに変換する
 * (Push API の applicationServerKey に渡すためのMDN定番実装)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  console.log(`urlBase64ToUint8Array(${base64String})`)
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.fromBase64(base64)
}

interface AppProps extends ComponentProps<"div"> {
  "data-session-id": string
  "data-vapid-public-key": string
}
export default function App(props: AppProps) {
  const [isPending, startTransition] = useTransition()
  const [isSending, startSendTransition] = useTransition()
  const [isRegistered, setIsRegistered] = useState(false)

  async function handleRegisterClient() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support Web Push")
    }

    startTransition(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Notification permission not granted")
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(props["data-vapid-public-key"]),
      })

      const { endpoint, keys } = subscription.toJSON()
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error("Invalid push subscription")
      }

      const res = await client.api.register.$post({
        json: {
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to register client: ${res.status}`)
      }

      setIsRegistered(true)
    })
  }

  function handleSendTestNotification() {
    startSendTransition(async () => {
      const res = await client.api.push[":sessionId"].$post({
        param: { sessionId: props["data-session-id"] },
        json: {
          title: "Test notification",
          body: "This is a test notification from pushnot.",
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to send test notification: ${res.status}`)
      }
    })
  }

  return (
    <div {...props}>
      <p>Session ID: {props["data-session-id"]}</p>
      <Button onClick={handleRegisterClient} disabled={isPending}>
        {isPending ? "Registering..." : "Register client"}
      </Button>
      <Button onClick={handleSendTestNotification} disabled={!isRegistered || isSending}>
        {isSending ? "Sending..." : "Send test notification"}
      </Button>
    </div>
  )
}
