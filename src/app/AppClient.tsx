"use client"

import {
  ArrowsDownUpIcon,
  BellSlashIcon,
  CheckIcon,
  DesktopIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { hc } from "hono/client"
import { Suspense, use, useState, useTransition } from "react"
import { browser } from "react-dom"
import { z } from "zod"

import { DataTable } from "@/components/data-table"
import type { DataTableFeatures } from "@/components/data-table"
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { NotificationRow } from "@/do/session/schema/notification"
import { notificationSchema } from "@/do/session/schema/notification-payload"

import type { AppType } from ".."
import serviceWorkerUrl from "../sw.ts?worker&url"
import { useNotificationsStore } from "./notifications-store"

const client = hc<AppType>("/")
const notificationsSchema = z.object({ notifications: z.array(notificationSchema) })

function NotificationsSocket() {
  use(browser("Notifications require a browser WebSocket connection."))

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const socket = new WebSocket(`${wsProtocol}//${window.location.host}/api/notifications/ws`)
  socket.addEventListener("message", (event) => {
    const data = notificationsSchema.parse(JSON.parse(event.data))
    useNotificationsStore.getState().addNotifications(data.notifications)
  })

  return null
}

const notificationColumns: ColumnDef<DataTableFeatures, NotificationRow, unknown>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Sent at
        <ArrowsDownUpIcon data-icon="inline-end" />
      </Button>
    ),
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "body",
    header: "Body",
    cell: ({ row }) => row.original.body ?? "-",
  },
  {
    accessorKey: "success",
    header: "Result",
    cell: ({ row }) =>
      row.original.success ? (
        <Badge variant="secondary">Sent</Badge>
      ) : (
        <Badge variant="destructive">Failed</Badge>
      ),
  },
]

export function ThemeToggle() {
  const theme = useTheme((state) => state.theme)
  const setTheme = useTheme((state) => state.setTheme)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label="Toggle theme" />}
      >
        {theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <DesktopIcon />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <SunIcon data-icon="inline-start" />
            Light
            {theme === "light" && <CheckIcon data-icon="inline-end" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <MoonIcon data-icon="inline-start" />
            Dark
            {theme === "dark" && <CheckIcon data-icon="inline-end" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <DesktopIcon data-icon="inline-start" />
            System
            {theme === "system" && <CheckIcon data-icon="inline-end" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface AppClientProps {
  sessionId: string
  vapidPublicKey: string
  initialRegistered: boolean
}
export default function AppClient({
  sessionId,
  vapidPublicKey,
  initialRegistered,
}: AppClientProps) {
  const [isRegistering, startRegisterTransition] = useTransition()
  const [isSending, startSendTransition] = useTransition()
  const [isRegistered, setIsRegistered] = useState(initialRegistered)
  const notifications = useNotificationsStore((state) => state.notifications)
  useTheme()

  async function handleToggleRegistration() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support Web Push")
    }

    startRegisterTransition(async () => {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: "/" })
      await navigator.serviceWorker.ready

      if (isRegistered) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const { endpoint } = subscription.toJSON()
          if (endpoint) {
            const res = await client.api.unregister.$post({ json: { endpoint } })
            if (!res.ok) {
              throw new Error(`Failed to unregister client: ${res.status}`)
            }
          }
          await subscription.unsubscribe()
        }
        setIsRegistered(false)
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Notification permission not granted")
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.fromBase64(vapidPublicKey, {
          alphabet: "base64url",
        }),
      })

      const { endpoint, keys } = subscription.toJSON()
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error("Invalid push subscription")
      }

      const res = await client.api.register.$post({
        json: {
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to register client: ${res.status}`)
      }

      setIsRegistered(true)
    })
  }

  function handleSendTestNotification() {
    startSendTransition(async () => {
      const res = await client.api.push[":sessionId"].$post({
        param: { sessionId },
        json: {
          title: "Test notification",
          body: "This is a test notification from pushnot.",
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to send test notification: ${res.status}`)
      }
    })
  }

  const registerLabel = isRegistering
    ? isRegistered
      ? "Unregistering..."
      : "Registering..."
    : isRegistered
      ? "Unregister client"
      : "Register client"

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <NotificationsSocket />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Device</CardTitle>
          <CardDescription>Register this browser to receive push notifications.</CardDescription>
          <CardAction>
            <Badge variant={isRegistered ? "secondary" : "outline"}>
              {isRegistered ? "Registered" : "Not registered"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            onClick={handleToggleRegistration}
            disabled={isRegistering}
            variant={isRegistered ? "outline" : "default"}
          >
            {isRegistering && <Spinner data-icon="inline-start" />}
            {registerLabel}
          </Button>
          <Button
            onClick={handleSendTestNotification}
            disabled={!isRegistered || isSending}
            variant="outline"
          >
            {isSending && <Spinner data-icon="inline-start" />}
            {isSending ? "Sending..." : "Send test notification"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notification history</CardTitle>
          <CardDescription>Recent push notifications sent to this session.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellSlashIcon />
                </EmptyMedia>
                <EmptyTitle>No notifications yet</EmptyTitle>
                <EmptyDescription>
                  Send a test notification to see delivery history here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <DataTable columns={notificationColumns} data={notifications} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
