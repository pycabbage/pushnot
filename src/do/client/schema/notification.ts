import { sqliteTable, integer } from "drizzle-orm/sqlite-core"

export const notificationTable = sqliteTable("notification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
})
