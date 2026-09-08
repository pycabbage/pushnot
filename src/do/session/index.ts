import { DurableObject } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"

import migrations from "../../../drizzle/session/migrations"
import { sendWebPush } from "../../lib/web-push"
import { relations } from "./relations"
import { notificationTable, subscriberTable } from "./schema"

type RegisterInput = Pick<typeof subscriberTable.$inferInsert, "endpoint" | "p256dh" | "auth">
type PushInput = { title: string; body?: string }

export class SessionDO extends DurableObject<CloudflareBindings> {
  db: DrizzleSqliteDODatabase<typeof relations>

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    this.db = drizzle(ctx.storage, { relations })
    void ctx.blockConcurrencyWhile(async () => {
      migrate(this.db, migrations)
    })
  }

  async register(subscription: RegisterInput) {
    await this.db
      .insert(subscriberTable)
      .values(subscription)
      .onConflictDoUpdate({
        target: subscriberTable.endpoint,
        set: { p256dh: subscription.p256dh, auth: subscription.auth },
      })
  }

  async unregister(endpoint: string) {
    await this.db.delete(subscriberTable).where(eq(subscriberTable.endpoint, endpoint))
  }

  async hasSubscribers() {
    const [subscriber] = await this.db
      .select({ endpoint: subscriberTable.endpoint })
      .from(subscriberTable)
      .limit(1)
    return subscriber !== undefined
  }

  async push(payload: PushInput) {
    const subscribers = await this.db.select().from(subscriberTable)

    const results = await Promise.all(
      subscribers.map(async (subscriber) => {
        const result = await sendWebPush(subscriber, payload, this.env)
        if (result.status === "gone") {
          // 購読が失効しているため削除する
          await this.db
            .delete(subscriberTable)
            .where(eq(subscriberTable.endpoint, subscriber.endpoint))
        }

        await this.db.insert(notificationTable).values({
          ...payload,
          success: result.status === "sent",
          failureReason:
            result.status === "sent"
              ? null
              : result.status === "gone"
                ? "gone"
                : `http ${result.httpStatus}`,
        })

        return result.status
      })
    )

    const sentCount = results.filter((status) => status === "sent").length
    const failedCount = results.filter((status) => status === "error").length

    return { totalSubscribers: subscribers.length, sentCount, failedCount }
  }
}
