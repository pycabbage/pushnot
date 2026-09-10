import { createFromReadableStream, getClientEntryUrl } from "@vitejs/plugin-rsc/ssr"
import { use } from "react"
import { renderToReadableStream } from "react-dom/server.edge"

import type { RscPayload } from "./payload"

export async function renderHTML(rscStream: ReadableStream<Uint8Array>) {
  const payloadPromise = createFromReadableStream<RscPayload>(rscStream)
  function Root() {
    return use(payloadPromise).root
  }

  return renderToReadableStream(<Root />, {
    bootstrapModules: [getClientEntryUrl()],
  })
}
