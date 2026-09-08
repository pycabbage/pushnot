// Web Pushの購読(subscribe)にはアクティブなServiceWorkerRegistrationが必須なため、
// 登録機能のために最小限のService Workerを用意している。

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
