import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/do/client/schema/index.ts",
  out: "./drizzle/client",
  dialect: "sqlite",
  driver: "durable-sqlite",
})
