// 써보니 서비스 워커: 휴대폰 알림(웹 푸시)을 보여 주고, 누르면 해당 화면을 연다. 화면 캐시는 하지 않는다(항상 최신).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "써보니";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/notifications" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : "/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        await c.focus();
        if ("navigate" in c) return c.navigate(url);
        return;
      }
    }
    return self.clients.openWindow(url);
  })());
});
