import type { ReactNode } from "react"
import { renderToReadableStream } from "react-dom/server"
import { Link, ReactRefresh, Script, ViteClient } from "vite-ssr-components/react"

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

export function renderPage(children: ReactNode): Promise<ReadableStream<Uint8Array>> {
  // renderToReadableStream automatically prepends "<!DOCTYPE html>" when the
  // root element is <html>, so it is not added manually here.
  return renderToReadableStream(<Layout>{children}</Layout>)
}
