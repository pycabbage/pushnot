import { env } from "cloudflare:workers"

import { QR } from "@/components/qr"
import { RepoLink } from "@/components/repo-link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { URLBox } from "@/components/url-box"

import type { Env } from "../env"
import AppClient, { ThemeToggle } from "./AppClient"

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
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-lg font-semibold">pushnot</h1>
          <p className="text-xs text-muted-foreground">Notification delivery for agents.</p>
        </div>
        <div className="flex items-center gap-2">
          <RepoLink />
          <ThemeToggle />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>
            Add a hook to your coding agent to deliver notifications to this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude_code">
            <TabsList>
              <TabsTrigger value="claude_code">Claude Code</TabsTrigger>
              <TabsTrigger value="codex">Codex</TabsTrigger>
              <TabsTrigger value="opencode">OpenCode</TabsTrigger>
              <TabsTrigger value="copilot_cli">Copilot CLI</TabsTrigger>
            </TabsList>
            <TabsContent value="claude_code" className="flex flex-col gap-2 pt-3">
              <p>
                Add hooks to{" "}
                <code className="rounded-none bg-muted px-1 py-0.5">~/.claude/settings.json</code>:
              </p>
              <Textarea
                readOnly
                aria-label="Claude Code hook configuration"
                className="resize-none font-mono"
              >
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
            <TabsContent value="codex" className="flex flex-col gap-2 pt-3">
              <p>
                Add hooks to{" "}
                <code className="rounded-none bg-muted px-1 py-0.5">~/.codex/hooks.json</code>:
              </p>
              <Textarea
                readOnly
                aria-label="Codex hook configuration"
                className="resize-none font-mono"
              >
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
              <p className="text-muted-foreground">
                If{" "}
                <code className="rounded-none bg-muted px-1 py-0.5">
                  approvals_reviewer = "auto_review"
                </code>{" "}
                is set, PermissionRequest can be omitted.
              </p>
            </TabsContent>
            <TabsContent value="opencode" className="flex flex-col gap-2 pt-3">
              <p>
                Add plugin configuration to{" "}
                <code className="rounded-none bg-muted px-1 py-0.5">
                  ~/.config/opencode/opencode.jsonc
                </code>
                :
              </p>
              <Textarea
                readOnly
                aria-label="OpenCode hook configuration"
                className="resize-none font-mono"
              >
                {`
{
  "plugin": [
    [
      "opencode-pushnot@latest",
      {
        "session": "${vars.sessionId}",
      },
    ],
  ],
}
`.trim()}
              </Textarea>
            </TabsContent>
            <TabsContent value="copilot_cli" className="flex flex-col gap-2 pt-3">
              <p>
                Create{" "}
                <code className="rounded-none bg-muted px-1 py-0.5">
                  ~/.copilot/hooks/pushnot.json
                </code>
                :
              </p>
              <Textarea
                readOnly
                aria-label="Codex hook configuration"
                className="resize-none font-mono"
              >
                {`
{
  "version": 1,
  "hooks": {
    "agentStop": [
      {
        "type": "http",
        "url": "${pushURL}"
      }
    ]
  }
}
`.trim()}
              </Textarea>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter>
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  Add other device
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add other device</DialogTitle>
                <DialogDescription>
                  Scan the QR code or copy the link on another device to join this session.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4">
                <div className="border bg-background p-3">
                  <QR className="aspect-square size-40" url={joinURL.toString()} />
                </div>
                <URLBox url={joinURL.toString()} />
              </div>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

      <AppClient
        sessionId={vars.sessionId}
        vapidPublicKey={env.VAPID_PUBLIC_KEY}
        initialRegistered={isRegistered}
      />
    </main>
  )
}
