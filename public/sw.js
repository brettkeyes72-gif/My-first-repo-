// Service worker: shows board alerts when a new message arrives, even with the site closed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (err) { d = { title: "SSC × TRUCK Board", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "SSC × TRUCK Board", {
    body: d.body || "",
    icon: "img/icon-192.png",
    badge: "img/icon-192.png",
    tag: d.tag,
    renotify: true,
    data: { url: d.url || "./" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
