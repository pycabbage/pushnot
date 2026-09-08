import { DurableObject } from "cloudflare:workers"
import { desc, eq } from "drizzle-orm"
import { DrizzleSqliteDODatabase, drizzle } from "drizzle-orm/durable-sqlite"
import { migrate } from "drizzle-orm/durable-sqlite/migrator"
import type { z } from "zod"

import migrations from "../../../drizzle/session/migrations"
import { pushSchema } from "../../api/push"
import { sendWebPush } from "../../lib/web-push"
import { relations } from "./relations"
import { notificationTable, subscriberTable } from "./schema"

type RegisterInput = Pick<typeof subscriberTable.$inferInsert, "endpoint" | "p256dh" | "auth">
type PushInput = z.infer<typeof pushSchema>

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

  async listNotifications() {
    return this.db.select().from(notificationTable).orderBy(desc(notificationTable.createdAt))
  }

  async fetch(_request: Request): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.send(JSON.stringify({ notifications: await this.listNotifications() }))
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason)
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

        const [notification] = await this.db
          .insert(notificationTable)
          .values({
            ...payload,
            endpoint: subscriber.endpoint,
            success: result.status === "sent",
            failureReason:
              result.status === "sent"
                ? null
                : result.status === "gone"
                  ? "gone"
                  : `http ${result.httpStatus}`,
          })
          .returning()

        return { status: result.status, notification }
      })
    )

    const sentCount = results.filter((result) => result.status === "sent").length
    const failedCount = results.filter((result) => result.status === "error").length

    const notifications = results.map((result) => result.notification)
    if (notifications.length > 0) {
      const message = JSON.stringify({ notifications })
      for (const ws of this.ctx.getWebSockets()) {
        ws.send(message)
      }
    }

    return { totalSubscribers: subscribers.length, sentCount, failedCount }
  }
}
