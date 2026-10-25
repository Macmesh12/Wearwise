self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "WearWise notification",
    body: "You have a new store update.",
  };
  event.waitUntil(
    self.registration.showNotification(data.title ?? "WearWise", {
      body: data.body ?? "You have a new store update.",
      icon: "/admin-pwa-icon.png",
      badge: "/admin-pwa-icon.png",
      data: { url: data.url ?? "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? "/admin"));
});
