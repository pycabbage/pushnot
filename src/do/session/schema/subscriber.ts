import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * ブラウザなど、プッシュ通知のsubscriber
 */
export const subscriberTable = sqliteTable("subscriber", {
  /** Push Subscriptionのエンドポイント URL(Subscriptionごとに一意) */
  endpoint: text("endpoint").primaryKey(),
  /** 暗号化鍵 */
  p256dh: text("p256dh").notNull(),
  /** 認証シークレット */
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
