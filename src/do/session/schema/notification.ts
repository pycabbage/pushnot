import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * 通知の送信履歴
 */
export const notificationTable = sqliteTable("notification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
