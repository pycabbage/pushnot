import { create } from "zustand"

import type { NotificationRow } from "@/do/session/schema/notification"

interface NotificationsState {
  notifications: NotificationRow[]
  addNotifications: (rows: NotificationRow[]) => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  addNotifications: (rows) =>
    set((state) => ({ notifications: [...rows, ...state.notifications] })),
}))
