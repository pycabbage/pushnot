import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const subscriberTable = sqliteTable("subscriber", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})
