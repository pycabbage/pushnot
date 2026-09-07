import { sqliteTable, text } from "drizzle-orm/sqlite-core"

export const clientTable = sqliteTable("client", {
  id: text("id").primaryKey(),
})
