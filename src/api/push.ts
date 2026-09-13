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
const copilotStopSchemaCamel = z.object({
  sessionId: z.string(),
  timestamp: z.number(),
  cwd: z.string(),
  transcriptPath: z.string(),
  stopReason: z.literal("end_turn"),
  stop_hook_active: z.boolean(),
})
const copilotStopSchema = z.union([
  copilotStopSchemaCamel,
  z.object({
    session_id: z.string(),
    timestamp: z.string(),
    cwd: z.string(),
    transcript_path: z.string(),
    stop_reason: z.literal("end_turn"),
    stop_hook_active: z.boolean(),
  }),
])
export const defaultPushSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
})

const pushSchema = z.codec(
  z.union([defaultPushSchema, ccStopSchema, codexStopSchema, copilotStopSchema]),
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
    z.object({
      type: z.literal("copilot"),
      data: copilotStopSchemaCamel,
    }),
  ]),
  {
    encode: ({ data }) => data,
    decode: (value) => {
      if ("title" in value) {
        return {
          type: "default" as const,
          data: value,
        }
      } else if ("stopReason" in value) {
        return {
          type: "copilot" as const,
          data: value,
        }
      } else if ("stop_reason" in value) {
        return {
          type: "copilot" as const,
          data: {
            sessionId: value.session_id,
            timestamp: Number(value.timestamp),
            cwd: value.cwd,
            transcriptPath: value.transcript_path,
            stopReason: value.stop_reason,
            stop_hook_active: value.stop_hook_active,
          },
        }
      } else if ("turn_id" in value && "model" in value) {
        return {
          type: "codex" as const,
          data: value,
        }
      } else if (
        "session_id" in value &&
        "hook_event_name" in value &&
        "last_assistant_message" in value
      ) {
        return {
          type: "cc" as const,
          data: value,
        }
      } else {
        throw new Error(`Unknown push payload: ${JSON.stringify(value)}`)
      }
    },
  }
)

export const push = factory
  .createApp()
  // .use("/", async (c, next) => {
  //   console.debug("payload:", JSON.stringify(await c.req.json()))
  //   console.debug("header:", JSON.stringify(c.req.header()))
  //   return next()
  // })
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
          : payload.type === "codex"
            ? {
                title: `Codex: ${payload.data.hook_event_name}`,
                body: payload.data.last_assistant_message,
              }
            : {
                title: `Copilot: ${payload.data.stopReason}`,
                body: `Session ID: ${payload.data.sessionId}`,
              }
    )

    if (payload.type === "codex" || payload.type === "cc") {
      return c.body(null, 204)
    }
    if (payload.type === "copilot") {
      return c.json({
        decision: "allow",
      })
    }

    return c.json(result)
  })
