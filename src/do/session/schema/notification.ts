import { sqliteTable, integer } from "drizzle-orm/sqlite-core"

/**
 * 通知の送信履歴
 */
export const notificationTable = sqliteTable("notification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
})
