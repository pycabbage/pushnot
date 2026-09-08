import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * 通知の送信履歴
 */
export const notificationTable = sqliteTable("notification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body"),
  /** 送信先のPush Subscriptionエンドポイント(このカラム追加以前の行はnull) */
  endpoint: text("endpoint"),
  /** 送信に成功したかどうか */
  success: integer("success", { mode: "boolean" }).notNull().default(false),
  /** 失敗理由(成功時はnull) */
  failureReason: text("failure_reason"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type NotificationRow = typeof notificationTable.$inferSelect
