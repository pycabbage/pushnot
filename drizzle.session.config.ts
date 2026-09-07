import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/do/session/schema/index.ts",
  out: "./drizzle/session",
  dialect: "sqlite",
  driver: "durable-sqlite",
})
