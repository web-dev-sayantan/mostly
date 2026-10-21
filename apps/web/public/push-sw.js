/* global self, clients */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const count = Number(data.count);
  let body = "Close the day when you're ready.";
  if (data.test) {
    body = "Test notification. You'll get one reminder a day.";
  } else if (Number.isInteger(count) && count > 0) {
    body = `${count} ${count === 1 ? "goal" : "goals"} left today. Close the day when you're ready.`;
  }

  event.waitUntil(
    self.registration.showNotification("Mostly", {
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      tag: "mostly-reminder",
      data: { url: "/today" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/today",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const match = windows.find((windowClient) => windowClient.url === target);
      await (match ? match.focus() : clients.openWindow(target));
    })()
  );
});
