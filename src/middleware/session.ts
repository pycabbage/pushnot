import { getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import { sign, verify } from "hono/jwt"

import type { Env } from "../env"

const SESSION_COOKIE_NAME = "session"
// Cookie/JWTのexp/Max-Ageに使える上限値(1年)
const SESSION_MAX_AGE = 60 * 60 * 24 * 365

export const session = createMiddleware<Env>(async (c, next) => {
  // Skip session handling for /api/push/*
  if (c.req.path.startsWith("/api/push/")) {
    return next()
  }

  const token = getCookie(c, SESSION_COOKIE_NAME)
  const sub = token ? (await verify(token, c.env.SESSION_SECRET, "HS256")).sub : undefined

  if (typeof sub === "string") {
    c.set("sessionId", sub)
    return next()
  }

  // 匿名セッションを新規作成する
  const newSessionId = crypto.randomUUID()
  const newToken = await sign(
    { sub: newSessionId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE },
    c.env.SESSION_SECRET
  )

  setCookie(c, SESSION_COOKIE_NAME, newToken, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
  })

  c.set("sessionId", newSessionId)
  return next()
})
