import { createMiddleware } from "hono/factory"
import type { ReactNode } from "react"
import { renderToReadableStream } from "react-dom/server"
import { Link, ReactRefresh, Script, ViteClient } from "vite-ssr-components/react"

import type { Env } from "../env"

declare module "hono" {
  interface ContextRenderer {
    (children: ReactNode): Response | Promise<Response>
  }
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        <ViteClient />
        <ReactRefresh />
        <Script src="/src/client/index.tsx" />
        <Link href="/src/style.css" rel="stylesheet" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}

export const renderer = createMiddleware<Env>(async (c, next) => {
  c.setRenderer(async (children) => {
    const stream = await renderToReadableStream(<Layout>{children}</Layout>)
    return c.body(stream, 200, { "Content-Type": "text/html; charset=UTF-8" })
  })
  await next()
})
