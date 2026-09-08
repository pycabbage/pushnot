import { hydrateRoot } from "react-dom/client"

import App from "./App"

const root = document.getElementById("root")

if (root) {
  const sessionId = root.querySelector("[data-session-id]")?.getAttribute("data-session-id") ?? ""
  const vapidPublicKey =
    root.querySelector("[data-vapid-public-key]")?.getAttribute("data-vapid-public-key") ?? ""
  const initialRegistered =
    root.querySelector("[data-initial-registered]")?.getAttribute("data-initial-registered") ===
    "true"

  hydrateRoot(
    root,
    <App
      data-session-id={sessionId}
      data-vapid-public-key={vapidPublicKey}
      data-initial-registered={initialRegistered}
    />
  )
}
