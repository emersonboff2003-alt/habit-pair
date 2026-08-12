/* Habit Pair — Service Worker (PWA) */

// Bump a versão (ex.: v2) sempre que o app for atualizado para forçar
// o navegador a instalar o service worker novo e limpar caches antigos.
const CACHE_NAME = "habit-pair-v3";
const CORE_ASSETS = [
  "/",
  "/select-profile",
  "/logs",
  "/missions",
  "/store",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação: network-first com fallback para cache e, por fim, a home.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback ?? new Response("Offline", { status: 503 });
        }),
    );
    return;
  }

  // Ativos estáticos: cache-first com revalidação em segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});

// -----------------------------------------------------------------------------
// Notificações Web Push
// -----------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Habit Pair";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192-maskable.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "habit-pair",
    data: { url: data.url || "/logs" },
    lang: "pt-BR",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/logs";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url).catch(() => client.focus());
          return client.focus();
        }
      }
      return self.clients
        .matchAll({ type: "window" })
        .then(() => self.clients.openWindow(url));
    }),
  );
});

self.addEventListener("notificationclose", (event) => {
  event.notification.close();
});
