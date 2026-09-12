import { env } from "cloudflare:workers"

import { QR } from "@/components/qr"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { URLBox } from "@/components/url-box"

import type { Env } from "../env"
import AppClient from "./AppClient"

interface AppProps {
  vars: Env["Variables"]
  url: string
}
export default async function App({ vars, url }: AppProps) {
  const stub = env.SESSION_DO.getByName(vars.sessionId)
  const isRegistered = await stub.hasSubscribers()
  const joinURL = new URL(url)
  joinURL.searchParams.set("join", vars.jwtPayload)
  const pushURL = new URL(url)
  pushURL.pathname = `/api/push/${vars.sessionId}`

  return (
    <>
      <h1 className="">pushnot</h1>
      <p className="">Notification delivery for agents.</p>
      <p className="">Installation instructions:</p>
      <Tabs defaultValue="claude_code">
        <TabsList>
          <TabsTrigger value="claude_code">Claude Code</TabsTrigger>
          <TabsTrigger value="codex">Codex</TabsTrigger>
          <TabsTrigger value="opencode">OpenCode</TabsTrigger>
        </TabsList>
        <TabsContent value="claude_code">
          Add hooks to <code>~/.claude/settings.json</code> :
          <Textarea readOnly className="resize-none">
            {`
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "${pushURL}"
          }
        ]
      }
    ]
  }
}
`.trim()}
          </Textarea>
        </TabsContent>
        <TabsContent value="codex">
          Add hooks to <code>~/.codex/hooks.json</code> :
          <Textarea readOnly className="resize-none">
            {`
{
  "hooks": {
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST -H 'Content-Type: application/json' -d @- -s ${pushURL}"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -X POST -H 'Content-Type: application/json' -d @- -s ${pushURL}"
          }
        ]
      }
    ]
  }
}
`.trim()}
          </Textarea>
          If <code>approvals_reviewer = "auto_review"</code> is set, PermissionRequest can be
          omitted.
        </TabsContent>
        <TabsContent value="opencode">Under construction.</TabsContent>
      </Tabs>
      <AppClient
        sessionId={vars.sessionId}
        vapidPublicKey={env.VAPID_PUBLIC_KEY}
        initialRegistered={isRegistered}
      />
      <Dialog>
        <DialogTrigger render={<Button>Add other device</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add other device</DialogTitle>
          </DialogHeader>
          <URLBox url={joinURL.toString()} />
          <QR className="aspect-square size-48" url={joinURL.toString()} />
        </DialogContent>
      </Dialog>
    </>
  )
}
