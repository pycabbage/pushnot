// Web Pushの購読(subscribe)にはアクティブなServiceWorkerRegistrationが必須なため、
// 登録機能のために最小限のService Workerを用意している。
//
// NOTE: pushイベントを受信して通知を表示するロジックは別タスクで実装予定のため、
// このファイルでは実装しない。

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
