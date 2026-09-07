import { cloudflare } from "@cloudflare/vite-plugin"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import ssrPlugin from "vite-ssr-components/plugin"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
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
