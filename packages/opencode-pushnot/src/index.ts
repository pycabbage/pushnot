import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

interface SendNotificationOptions {
  baseURL: string
  sessionId: string
  title: string
  body: string
}
async function sendNotification({ baseURL, sessionId, ...payload }: SendNotificationOptions) {
  const url = new URL(`/api/push/${sessionId}`, baseURL)
  return await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export const PushnotPlugin: Plugin = async (_, options) => {
  const { session, baseURL = "https://pushnot.cabbagelettuce.com/" } = options ?? {}
  if (typeof session !== "string" || typeof baseURL !== "string") {
    console.error("Invalid option provided.")
    return {}
  }

  return {
    async event({ event }) {
      switch (event.type) {
        case "session.idle":
          await sendNotification({
            baseURL,
            sessionId: session,
            title: `OpenCode: Session Idle`,
            body: `Session ${event.properties.sessionID} is now idle.`,
          })
          break
      }
    },
    async "permission.ask"({ title }) {
      // Send notification
      await sendNotification({
        baseURL,
        sessionId: session,
        title: `OpenCode: Ask permissions`,
        body: `${title}`,
      })
    },
    async "tool.execute.after"({ tool, args }) {
      if (tool === "question") {
        await sendNotification({
          baseURL,
          sessionId: session,
          title: `OpenCode: Ask question`,
          body: `${JSON.stringify(args)}`,
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
          try {
            await sendNotification({
              baseURL,
              sessionId: session,
              title: `OpenCode: Agent sent notification`,
              body: payload,
            })
            return "Notification sent successfully."
          } catch {
            return `Failed to send notification`
          }
        },
      }),
    },
  }
}
