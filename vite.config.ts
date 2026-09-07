import { cloudflare } from "@cloudflare/vite-plugin"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import ssrPlugin from "vite-ssr-components/plugin"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    cloudflare(),
    ssrPlugin({
      hotReload: {
        ignore: ["./src/client/**/*.tsx"],
      },
    }),
    react(),
    tailwindcss(),
  ],
})
