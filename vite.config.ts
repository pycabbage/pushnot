import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import rsc from "@vitejs/plugin-rsc"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
    rsc({ serverHandler: false }),
    react({
      compiler: true,
    }),
    tailwindcss(),
  ],
  environments: {
    ssr: {
      build: {
        outDir: "dist/rsc/ssr",
        rolldownOptions: {
          input: { index: "./src/rsc/entry.ssr.tsx" },
        },
      },
    },
    client: {
      build: {
        rolldownOptions: {
          input: { index: "./src/rsc/entry.browser.tsx" },
        },
      },
    },
  },
})
