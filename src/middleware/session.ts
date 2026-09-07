import { createMiddleware } from "hono/factory"
import { getCookie, setCookie } from "hono/cookie"
import { sign, verify } from "hono/jwt"
import type { Env } from "../env"

const SESSION_COOKIE_NAME = "session"
// Cookie/JWTのexp/Max-Ageに使える上限値(1年)
const SESSION_MAX_AGE = 60 * 60 * 24 * 365

export const session = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  const sessionId = token ? await verifySessionToken(token, c.env.SESSION_SECRET) : undefined

  if (sessionId) {
    c.set("sessionId", sessionId)
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

async function verifySessionToken(token: string, secret: string): Promise<string | undefined> {
  try {
    const { sub } = await verify(token, secret, "HS256")
    return typeof sub === "string" ? sub : undefined
  } catch {
    return undefined
  }
}
