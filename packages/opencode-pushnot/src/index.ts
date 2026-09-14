import type { Plugin, PluginInput } from "@opencode-ai/plugin"
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

interface GetLastMessageOptions {
  client: PluginInput["client"]
  sessionID: string
}
async function getLastMessage({ client, sessionID }: GetLastMessageOptions): Promise<string> {
  const { data: messages } = await client.session.messages({
    path: {
      id: sessionID,
    },
  })
  const lastAssistantMessage = messages?.findLast((message) => message.info.role === "assistant")
  if (!lastAssistantMessage) {
    return ""
  }
  return lastAssistantMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

export const PushnotPlugin: Plugin = async ({ client }, options) => {
  const { session, baseURL = "https://pushnot.cabbagelettuce.com/" } = options ?? {}
  if (typeof session !== "string" || typeof baseURL !== "string") {
    console.error("Invalid option provided.")
    return {}
  }

  return {
    async config() {},
    async event({ event }) {
      switch (event.type) {
        case "session.idle":
          const { data: sessionData } = await client.session.get({
            path: {
              id: event.properties.sessionID,
            },
          })
          if (!sessionData) return
          if (sessionData.parentID) {
            return
          }
          await sendNotification({
            baseURL,
            sessionId: session,
            title: `OpenCode: Session ${sessionData.title ?? event.properties.sessionID} Idle`,
            body: await getLastMessage({ client, sessionID: event.properties.sessionID }),
          })
          break
        case "tui.toast.show":
          await sendNotification({
            baseURL,
            sessionId: session,
            title: `OpenCode: [${event.properties.variant}] ${event.properties.title ?? "Notification"} `,
            body: `${event.properties.message}`,
          })
          break
      }
    },
    async "permission.ask"({ title, sessionID }) {
      // Send notification
      await sendNotification({
        baseURL,
        sessionId: session,
        title: `OpenCode: Ask permissions (${sessionID})`,
        body: `${title}`,
      })
    },
    async "tool.execute.after"({ tool, args, sessionID }) {
      if (tool === "question") {
        await sendNotification({
          baseURL,
          sessionId: session,
          title: `OpenCode: Ask question (${sessionID})`,
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
          title: tool.schema.string().describe("Title of the notification"),
          body: tool.schema.string().describe("Body content of the notification"),
        },
        async execute({ title, body }, { sessionID }) {
          try {
            await sendNotification({
              baseURL,
              sessionId: session,
              title: `OpenCode: ${title} (${sessionID})`,
              body,
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
