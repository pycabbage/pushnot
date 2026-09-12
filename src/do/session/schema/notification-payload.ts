import { z } from "zod"

export const notificationSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  endpoint: z.string().nullable(),
  success: z.boolean(),
  failureReason: z.string().nullable(),
  createdAt: z.coerce.date(),
})
