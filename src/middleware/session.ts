import { getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import { sign, verify } from "hono/jwt"

import type { Env } from "../env"

const SESSION_COOKIE_NAME = "session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 365

export const session = createMiddleware<Env>(async (c, next) => {
  if (c.req.path.startsWith("/api/push/")) {
    return next()
  }

  const join = c.req.query("join")

  if (join) {
    const sub = (await verify(join, c.env.SESSION_SECRET, "HS256")).sub
    if (typeof sub === "string") {
      setCookie(c, SESSION_COOKIE_NAME, join, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: SESSION_MAX_AGE,
      })
      c.set("sessionId", sub)
      c.set("jwtPayload", join)
      return c.redirect(c.req.path)
    }
  }

  const token = getCookie(c, SESSION_COOKIE_NAME)
  const sub = token ? (await verify(token, c.env.SESSION_SECRET, "HS256")).sub : undefined

  if (typeof sub === "string") {
    c.set("sessionId", sub)
    c.set("jwtPayload", token)
    return next()
  }

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
  c.set("jwtPayload", newToken)
  return next()
})
