import { hc } from "hono/client"
import { useEffect, useState, useTransition } from "react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"

import type { AppType } from ".."

const client = hc<AppType>("/")

interface AppProps extends ComponentProps<"div"> {
  "data-session-id": string
  "data-vapid-public-key": string
}
export default function App(props: AppProps) {
  const [isPending, startTransition] = useTransition()
  const [isSending, startSendTransition] = useTransition()
  const [isRegistered, setIsRegistered] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    void (async () => {
      await navigator.serviceWorker.register("/sw.js")
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsRegistered(subscription !== null)
    })()
  }, [])

  async function handleToggleRegistration() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support Web Push")
    }

    startTransition(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      if (isRegistered) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const { endpoint } = subscription.toJSON()
          if (endpoint) {
            const res = await client.api.unregister.$post({ json: { endpoint } })
            if (!res.ok) {
              throw new Error(`Failed to unregister client: ${res.status}`)
            }
          }
          await subscription.unsubscribe()
        }
        setIsRegistered(false)
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Notification permission not granted")
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.fromBase64(props["data-vapid-public-key"], {
          alphabet: "base64url",
        }),
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

  const registerLabel = isPending
    ? isRegistered
      ? "Unregistering..."
      : "Registering..."
    : isRegistered
      ? "Unregister client"
      : "Register client"

  return (
    <div {...props}>
      <p>Session ID: {props["data-session-id"]}</p>
      <Button onClick={handleToggleRegistration} disabled={isPending}>
        {registerLabel}
      </Button>
      <Button onClick={handleSendTestNotification} disabled={!isRegistered || isSending}>
        {isSending ? "Sending..." : "Send test notification"}
      </Button>
    </div>
  )
}
