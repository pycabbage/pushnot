import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc/server"
import { createMiddleware } from "hono/factory"
import type { ReactNode } from "react"

import "../style.css"

import type { Env } from "../env"
import type { RscPayload } from "../rsc/payload"

declare module "hono" {
  interface ContextRenderer {
    (children: ReactNode): Response | Promise<Response>
  }
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>pushnot</title>
        <meta
          name="description"
          content="Deliver coding agent (Claude Code, Codex, and more) completion events to your browser as Web Push notifications."
        />
        {import.meta.env.DEV && <script type="module" src="/@vite/client" />}
        {import.meta.viteRsc.loadCss()}
      </head>
      <body>{children}</body>
    </html>
  )
}

export const renderer = createMiddleware<Env>(async (c, next) => {
  c.setRenderer(async (children) => {
    const rscStream = renderToReadableStream<RscPayload>({
      root: <Layout>{children}</Layout>,
    })

    const isRscRequest = c.req.header("accept")?.includes("text/x-component")
    if (isRscRequest) {
      return c.body(rscStream, 200, {
        "content-type": "text/x-component;charset=utf-8",
        vary: "accept",
      })
    }

    const ssrEntry = await import.meta.viteRsc.loadModule<typeof import("../rsc/entry.ssr")>(
      "ssr",
      "index"
    )
    const htmlStream = await ssrEntry.renderHTML(rscStream)

    return c.body(htmlStream, 200, { "Content-Type": "text/html; charset=UTF-8" })
  })
  await next()
})

if (import.meta.hot) {
  import.meta.hot.accept()
}
