import { sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * ブラウザなど、プッシュ通知のsubscriber
 */
export const subscriberTable = sqliteTable("subscriber", {
  id: text("id").primaryKey(),
})
