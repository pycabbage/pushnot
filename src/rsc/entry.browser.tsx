import { createFromReadableStream } from "@vitejs/plugin-rsc/browser"
import { use } from "react"
import { hydrateRoot } from "react-dom/client"

import type { RscPayload } from "./payload"

async function getPayload() {
  const response = await fetch(window.location.href, {
    headers: { accept: "text/x-component" },
  })
  if (!response.body) {
    throw new Error("Failed to fetch RSC payload: response has no body")
  }
  return createFromReadableStream<RscPayload>(response.body)
}

const payload = getPayload()

function Root() {
  return use(payload).root
}

hydrateRoot(document, <Root />)
