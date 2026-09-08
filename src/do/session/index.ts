import { DurableObject } from "cloudflare:workers"
import { DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"

import migrations from "../../../drizzle/session/migrations"
import { relations } from "./relations"
import { subscriberTable } from "./schema"

type RegisterInput = Pick<typeof subscriberTable.$inferInsert, "endpoint" | "p256dh" | "auth">

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

  async notify() {}
}
