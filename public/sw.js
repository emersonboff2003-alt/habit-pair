/* Habit Pair — Service Worker (PWA) */

// IMPORTANTE: as páginas são renderizadas no servidor com os dados do perfil
// logado. Cachear o HTML de "/", "/logs", etc. fazia um perfil ver os dados do
// outro (e pontos antigos) quando o app era reaberto offline. Por isso este
// service worker NUNCA cacheia documentos HTML — apenas ativos estáticos
// (ícones, manifest, chunks do Next).

// Bump a versão sempre que o app for atualizado para forçar a limpeza de
// caches antigos.
const CACHE_NAME = "habit-pair-v4";
const CORE_ASSETS = [
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

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação (documentos HTML): sempre network-first e SEM cache. Se estiver
  // offline, mostra uma mensagem genérica — nunca serve HTML de outro perfil.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        const body =
          "<!doctype html><html lang='pt-BR'><meta charset='utf-8'>" +
          "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
          "<style>body{font-family:system-ui,sans-serif;background:#09090b;color:#e4e4e7;" +
          "display:flex;min-height:100vh;align-items:center;justify-content:center;" +
          "text-align:center;padding:24px;margin:0}</style>" +
          "<div><h1 style='font-size:1.25rem;margin:0 0 8px'>Sem conexão</h1>" +
          "<p style='color:#a1a1aa;margin:0'>Conecte-se à internet para carregar seus dados.</p></div>";
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }),
    );
    return;
  }

  // Ativos estáticos: cache-first com revalidação em segundo plano.
  if (isStaticAsset(url)) {
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
    return;
  }

  // Demais GETs (ex.: payloads RSC do Next): sempre rede, sem cache.
  event.respondWith(fetch(request));
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
