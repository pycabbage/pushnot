import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { hc } from "hono/client"
import type { AppType } from "pushnot"

export const PushnotPlugin: Plugin = async (_, options) => {
  const { session, baseURL = "https://pushnot.cabbagelettuce.com/" } = options ?? {}
  if (typeof session !== "string" || typeof baseURL !== "string") {
    console.error("Invalid option provided.")
    return {}
  }
  const client = hc<AppType>(baseURL)

  return {
    async event({ event }) {
      switch (event.type) {
        case "session.idle":
          await client.api.push[":sessionId"].$post({
            param: {
              sessionId: session,
            },
            json: {
              title: `OpenCode: Session Idle`,
              body: `Session ${event.properties.sessionID} is now idle.`,
            },
          })
          break
      }
    },
    async "permission.ask"({ title }) {
      // Send notification
      await client.api.push[":sessionId"].$post({
        param: {
          sessionId: session,
        },
        json: {
          title: `OpenCode: Ask permissions`,
          body: `${title}`,
        },
      })
    },
    async "tool.execute.after"({ tool, args }) {
      if (tool === "question") {
        await client.api.push[":sessionId"].$post({
          param: {
            sessionId: session,
          },
          json: {
            title: `OpenCode: Ask question`,
            body: `${JSON.stringify(args)}`,
          },
        })
      }
    },
    tool: {
      notify: tool({
        description: `
Sends notifications to users.
This can be used for purposes such as reporting work progress.
`.trim(),
        args: {
          payload: tool.schema.string(),
        },
        async execute({ payload }) {
          const result = await client.api.push[":sessionId"].$post({
            param: {
              sessionId: session,
            },
            json: {
              title: `OpenCode: Agent sent notification`,
              body: payload,
            },
          })
          if (!result.ok) {
            return `Failed to send notification`
          }
          return "Notification sent successfully."
        },
      }),
    },
  }
}
