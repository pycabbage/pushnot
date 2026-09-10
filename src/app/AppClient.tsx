"use client"

import { ArrowsDownUpIcon, BellSlashIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { hc } from "hono/client"
import { Suspense, use, useState, useTransition } from "react"
import { browser } from "react-dom"
import { z } from "zod"

import { DataTable } from "@/components/data-table"
import type { DataTableFeatures } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { notificationSchema } from "@/do/session/schema/notification"
import type { NotificationRow } from "@/do/session/schema/notification"

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
    accessorKey: "endpoint",
    header: "Endpoint",
    cell: ({ row }) => (row.original.endpoint ? `...${row.original.endpoint.slice(-16)}` : "-"),
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
  {
    accessorKey: "failureReason",
    header: "Failure reason",
    cell: ({ row }) => row.original.failureReason ?? "-",
  },
]

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
  const [isPending, startTransition] = useTransition()
  const [isSending, startSendTransition] = useTransition()
  const [isRegistered, setIsRegistered] = useState(initialRegistered)
  const notifications = useNotificationsStore((state) => state.notifications)

  async function handleToggleRegistration() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support Web Push")
    }

    startTransition(async () => {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl)
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

  const registerLabel = isPending
    ? isRegistered
      ? "Unregistering..."
      : "Registering..."
    : isRegistered
      ? "Unregister client"
      : "Register client"

  return (
    <div>
      <Suspense fallback={null}>
        <NotificationsSocket />
      </Suspense>
      <p>Session ID: {sessionId}</p>
      <Button onClick={handleToggleRegistration} disabled={isPending}>
        {registerLabel}
      </Button>
      <Button onClick={handleSendTestNotification} disabled={!isRegistered || isSending}>
        {isSending ? "Sending..." : "Send test notification"}
      </Button>
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
    </div>
  )
}
