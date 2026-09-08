import { DurableObject } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"

import migrations from "../../../drizzle/session/migrations"
import { sendWebPush } from "../../lib/web-push"
import { relations } from "./relations"
import { notificationTable, subscriberTable } from "./schema"

type RegisterInput = Pick<typeof subscriberTable.$inferInsert, "endpoint" | "p256dh" | "auth">
type PushInput = Pick<typeof notificationTable.$inferInsert, "title" | "body">

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

  async push(payload: PushInput) {
    const subscribers = await this.db.select().from(subscriberTable)

    let sentCount = 0
    let failedCount = 0

    await Promise.all(
      subscribers.map(async (subscriber) => {
        const result = await sendWebPush(subscriber, payload, this.env)
        if (result.status === "sent") {
          sentCount++
        } else if (result.status === "gone") {
          // 購読が失効しているため削除する
          await this.db
            .delete(subscriberTable)
            .where(eq(subscriberTable.endpoint, subscriber.endpoint))
        } else {
          failedCount++
        }
      })
    )

    await this.db.insert(notificationTable).values(payload)

    return { totalSubscribers: subscribers.length, sentCount, failedCount }
  }
}
