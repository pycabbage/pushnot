import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import ssrPlugin from "vite-ssr-components/plugin"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    hmr: true,
  },
  plugins: [
    cloudflare(),
    ssrPlugin(),
    react({
      compiler: true,
    }),
    tailwindcss(),
  ],
})
