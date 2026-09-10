import { sign } from "hono/jwt"
import { z } from "zod"

const PUSH_TTL_SECONDS = 60
const RECORD_SIZE = 4096
const VAPID_SUBJECT = "mailto:pushnot@example.com"

const WEBPUSH_INFO_PREFIX = new TextEncoder().encode("WebPush: info\0")
const CEK_INFO = new TextEncoder().encode("Content-Encoding: aes128gcm\0")
const NONCE_INFO = new TextEncoder().encode("Content-Encoding: nonce\0")
const RECORD_DELIMITER = new Uint8Array([2])
const vapidPrivateKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string(),
  y: z.string(),
  d: z.string(),
})

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export type SendWebPushResult =
  | { status: "sent" }
  | { status: "gone" }
  | { status: "error"; httpStatus: number }

export type WebPushEnv = {
  VAPID_PRIVATE_KEY_JWK: string
  VAPID_PUBLIC_KEY: string
}

export async function sendWebPush(
  subscription: PushSubscriptionInput,
  payload: unknown,
  env: WebPushEnv
): Promise<SendWebPushResult> {
  const body = await encryptPayload(
    new TextEncoder().encode(JSON.stringify(payload)),
    subscription.p256dh,
    subscription.auth
  )
  const authorization = await buildVapidAuthHeader(subscription.endpoint, env)

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: String(PUSH_TTL_SECONDS),
      Authorization: authorization,
    },
    body,
  })

  if (response.ok) return { status: "sent" }
  if (response.status === 404 || response.status === 410) return { status: "gone" }
  return { status: "error", httpStatus: response.status }
}

async function buildVapidAuthHeader(endpoint: string, env: WebPushEnv): Promise<string> {
  const aud = new URL(endpoint).origin
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60
  const jwt = await sign(
    { aud, exp, sub: VAPID_SUBJECT },
    vapidPrivateKeySchema.parse(JSON.parse(env.VAPID_PRIVATE_KEY_JWK)),
    "ES256"
  )
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`
}

export async function encryptPayload(
  payload: Uint8Array<ArrayBuffer>,
  p256dh: string,
  auth: string
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublicBytes = Uint8Array.fromBase64(p256dh, { alphabet: "base64url" })
  const authSecret = Uint8Array.fromBase64(auth, { alphabet: "base64url" })

  const uaPublicKey = await crypto.subtle.importKey(
    "raw",
    uaPublicBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  )

  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])
  const asPublicBytes = toBytes(await crypto.subtle.exportKey("raw", asKeyPair.publicKey))

  const sharedSecret = toBytes(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256)
  )

  const keyInfo = concatBytes(WEBPUSH_INFO_PREFIX, uaPublicBytes, asPublicBytes)
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(ikm, salt, CEK_INFO, 16)
  const nonce = await hkdf(ikm, salt, NONCE_INFO, 12)

  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"])
  const paddedPlaintext = concatBytes(payload, RECORD_DELIMITER)
  const ciphertext = toBytes(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      cekKey,
      paddedPlaintext
    )
  )

  const header = new Uint8Array(16 + 4 + 1 + asPublicBytes.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false)
  header[20] = asPublicBytes.length
  header.set(asPublicBytes, 21)

  return concatBytes(header, ciphertext)
}

async function hkdf(
  ikm: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8
  )
  return toBytes(bits)
}

function toBytes(buffer: ArrayBuffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buffer)
}

function concatBytes(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  parts.reduce((offset, part) => {
    result.set(part, offset)
    return offset + part.length
  }, 0)
  return result
}
