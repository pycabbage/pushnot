import { hydrateRoot } from "react-dom/client"
import App from "./App"

const root = document.getElementById("root")

if (root) {
  const sessionId = root.querySelector("[data-session-id]")?.getAttribute("data-session-id") ?? ""
  hydrateRoot(root, <App sessionId={sessionId} />)
}
