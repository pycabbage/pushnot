self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  const title = typeof data.title === "string" ? data.title : "Notification"
  const options = typeof data.body === "string" ? { body: data.body } : undefined

  event.waitUntil(self.registration.showNotification(title, options))
})
