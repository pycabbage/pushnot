import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { z } from "zod"

export const notificationTable = sqliteTable("notification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body"),
  endpoint: text("endpoint"),
  success: integer("success", { mode: "boolean" }).notNull().default(false),
  failureReason: text("failure_reason"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type NotificationRow = typeof notificationTable.$inferSelect

export const notificationSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  endpoint: z.string().nullable(),
  success: z.boolean(),
  failureReason: z.string().nullable(),
  createdAt: z.coerce.date(),
})
