import { DurableObject } from "cloudflare:workers"
import { drizzle, DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"
import { relations } from "./relations"
import migrations from "../../../drizzle/client/migrations"

export class ClientDO extends DurableObject<CloudflareBindings> {
  db: DrizzleSqliteDODatabase<typeof relations>

  constructor(ctx: DurableObjectState, env: CloudflareBindings & Cloudflare.Env) {
    super(ctx, env)
    this.db = drizzle(ctx.storage, { relations, logger: true })
    void ctx.blockConcurrencyWhile(async () => {
      migrate(this.db, migrations)
    })
  }
}
