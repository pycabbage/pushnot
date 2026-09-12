import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { factory } from "../env"

const ccStopSchema = z.object({
  session_id: z.string(),
  hook_event_name: z.literal("Stop"),
  last_assistant_message: z.string(),
  scratchpad_dir: z.string(),
})

const codexStopSchema = z.object({
  session_id: z.string(),
  hook_event_name: z.literal("Stop"),
  last_assistant_message: z.string(),
  turn_id: z.string(),
  model: z.string(),
})

export const defaultPushSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
})

const pushSchema = z.codec(
  z.union([defaultPushSchema, ccStopSchema, codexStopSchema]),
  z.union([
    z.object({
      type: z.literal("default"),
      data: defaultPushSchema,
    }),
    z.object({
      type: z.literal("cc"),
      data: ccStopSchema,
    }),
    z.object({
      type: z.literal("codex"),
      data: codexStopSchema,
    }),
  ]),
  {
    encode: ({ data }) => data,
    decode: (value) => {
      if ("turn_id" in value && "model" in value) {
        return {
          type: "codex" as const,
          data: value,
        }
      }
      if (
        "session_id" in value &&
        "hook_event_name" in value &&
        "last_assistant_message" in value
      ) {
        return {
          type: "cc" as const,
          data: value,
        }
      }
      return {
        type: "default" as const,
        data: value,
      }
    },
  }
)

export const push = factory
  .createApp()
  .use(async (c, next) => {
    console.debug("payload:", JSON.stringify(await c.req.json()))
    console.debug("headers:", JSON.stringify(c.req.header()))
    return next()
  })
  .post("/:sessionId", zValidator("json", pushSchema), async (c) => {
    const sessionId = c.req.param("sessionId")
    const payload = c.req.valid("json")

    const stub = c.env.SESSION_DO.getByName(sessionId)
    const result = await stub.push(
      payload.type === "default"
        ? payload.data
        : payload.type === "cc"
          ? {
              title: `Claude Code: ${payload.data.hook_event_name}`,
              body: payload.data.last_assistant_message,
            }
          : {
              title: `Codex: ${payload.data.hook_event_name}`,
              body: payload.data.last_assistant_message,
            }
    )

    if (payload.type === "codex" || payload.type === "cc") {
      // hooks側がClaude Code/Codexの挙動へ干渉しない場合、何も出力しない必要がある
      return c.body(null, 204)
    }

    return c.json(result)
  })
