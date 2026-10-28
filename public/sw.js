// Service worker: carga sin conexión de lo ya visitado.
// - Estáticos de Next (/_next/static, con hash): primero caché.
// - Páginas y demás GET del propio origen: primero red, caché como respaldo.
// - Peticiones a Supabase y a otros orígenes: no se tocan (los datos siempre van a la red).
const CACHE = "rutina-seguimiento-v6";
const PRECACHE = ["/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest"];

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
  e.respondWith(fetchAndCache(req).catch(() => caches.match(req)));
});

function fetchAndCache(req) {
  return fetch(req).then((res) => {
    if (res.ok && res.type === "basic" && !res.redirected) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
}
