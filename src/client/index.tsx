import { hydrateRoot } from "react-dom/client"

import type { NotificationRow } from "@/do/session/schema/notification"

import App from "./App"
import { useNotificationsStore } from "./notifications-store"

const root = document.getElementById("root")

if (root) {
  const sessionId = root.querySelector("[data-session-id]")?.getAttribute("data-session-id") ?? ""
  const vapidPublicKey =
    root.querySelector("[data-vapid-public-key]")?.getAttribute("data-vapid-public-key") ?? ""
  const initialRegistered =
    root.querySelector("[data-initial-registered]")?.getAttribute("data-initial-registered") ===
    "true"

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const notificationsSocket = new WebSocket(
    `${wsProtocol}//${window.location.host}/api/notifications/ws`
  )
  notificationsSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data) as { notifications: NotificationRow[] }
    useNotificationsStore.getState().addNotifications(data.notifications)
  })

  hydrateRoot(
    root,
    <App
      data-session-id={sessionId}
      data-vapid-public-key={vapidPublicKey}
      data-initial-registered={initialRegistered}
    />
  )
}
