// Service worker: la app funciona sin conexión.
// - Estáticos de Next (/_next/static, con hash): primero caché.
// - Páginas y demás GET del propio origen: primero red, caché como respaldo.
//   Sin conexión, cualquier pestaña (Entrenar, Rutina, Progreso, Ajustes) se abre con la última
//   página de la app guardada: la vista se elige en el navegador según la URL.
// - Peticiones a Supabase y a otros orígenes: no se tocan (los datos siempre van a la red).
const CACHE = "rutina-seguimiento-v13";
const APP_PAGES = ["/entrenar", "/rutina", "/progreso", "/social", "/ajustes"];
const PRECACHE = ["/fitgym-azul-192.png", "/fitgym-azul-mark.png", "/fitgym-azul-512.png", "/fitgym-azul-apple.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Las peticiones RSC dependen de la sesión: no se cachean.
  if (req.headers.get("RSC") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetchAndCache(req)));
    return;
  }
  e.respondWith(fetchAndCache(req).catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? appPage() : Response.error()))));
});

// Cualquier página de la app ya guardada, o un aviso si todavía no hay ninguna.
async function appPage() {
  const cache = await caches.open(CACHE);
  for (const path of APP_PAGES) {
    const hit = await cache.match(path);
    if (hit) return hit;
  }
  return new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width\"><body style=\"background:#000;color:#f2f4f8;font-family:system-ui;padding:24px\">Sin conexión. Abre la app una vez con internet para poder usarla sin conexión.",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function fetchAndCache(req) {
  return fetch(req).then((res) => {
    if (res.ok && res.type === "basic" && !res.redirected) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
}

// Al tocar el aviso del descanso se vuelve a la app (o se abre si estaba cerrada).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      const url = (e.notification.data && e.notification.data.url) || "/entrenar";
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});

// Recordatorio diario (llega del servidor aunque la app esté cerrada).
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(data.title || "FitGym", {
    body: data.body || "Es hora de entrenar.",
    icon: "/fitgym-azul-192.png",
    badge: "/fitgym-azul-192.png",
    tag: "rutina-reminder",
    data: { url: data.url || "/entrenar" },
  }));
});

// El navegador cambió la suscripción a los avisos (caducó): se pide otra con las mismas
// opciones. La app la envía a la cuenta la próxima vez que se abre (ReminderDeviceSync).
self.addEventListener("pushsubscriptionchange", (e) => {
  const options = e.oldSubscription && e.oldSubscription.options;
  if (!options) return;
  e.waitUntil(self.registration.pushManager.subscribe(options).catch(() => {}));
});
