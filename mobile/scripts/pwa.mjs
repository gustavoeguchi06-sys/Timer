// Transforma a exportação web do Expo numa PWA instalável no iPhone (e Android/PC):
// manifesto, ícones, meta tags da Apple e service worker que guarda tudo para uso offline.
// Uso: node scripts/pwa.mjs <pasta-dist> <caminho-base, ex.: /Timer/>
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = process.argv[2] || "dist";
let base = process.argv[3] || "/";
if (!base.endsWith("/")) base += "/";

// ícones
mkdirSync(join(dist, "pwa"), { recursive: true });
for (const f of ["icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  copyFileSync(join("assets", "pwa", f), join(dist, "pwa", f));
}

// manifesto
const manifest = {
  name: "CT MAX TIMER",
  short_name: "CT MAX",
  description: "Timer de rounds e placar para academias de luta.",
  lang: "pt-BR",
  start_url: base,
  scope: base,
  display: "standalone",
  orientation: "any",
  background_color: "#0A1A33",
  theme_color: "#0A1A33",
  icons: [
    { src: `${base}pwa/icon-192.png`, sizes: "192x192", type: "image/png" },
    { src: `${base}pwa/icon-512.png`, sizes: "512x512", type: "image/png" },
    { src: `${base}pwa/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync(join(dist, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

// lista de arquivos para o service worker guardar
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dist, p).split("\\").join("/"));
  }
})(dist);
const precache = files.filter((f) => f !== "sw.js" && f !== "metadata.json").map((f) => base + (f === "index.html" ? "" : f));
const version = createHash("sha1").update(files.map((f) => f + statSync(join(dist, f)).size).join("|")).digest("hex").slice(0, 10);

writeFileSync(join(dist, "sw.js"), `// gerado por scripts/pwa.mjs
const CACHE = "ctmax-${version}";
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // páginas: tenta a rede (para pegar atualizações) e cai no cache quando está offline
    e.respondWith(fetch(req).catch(() => caches.match(${JSON.stringify(base)})));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && new URL(req.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
`);

// index.html: meta tags do iPhone, manifesto e registro do service worker
let html = readFileSync(join(dist, "index.html"), "utf8");
html = html.replace('<html lang="en">', '<html lang="pt-BR">');
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />'
);
const head = `
    <link rel="manifest" href="${base}manifest.webmanifest" />
    <meta name="theme-color" content="#0A1A33" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="CT MAX" />
    <link rel="apple-touch-icon" href="${base}pwa/icon-180.png" />
    <style>html, body { background: #0A1A33; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }</style>
  `;
html = html.replace("</head>", head + "</head>");
const sw = `
  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () { navigator.serviceWorker.register("${base}sw.js", { scope: "${base}" }); });
    }
  </script>
`;
html = html.replace("</body>", sw + "</body>");
writeFileSync(join(dist, "index.html"), html);

console.log(`PWA pronta: ${precache.length} arquivos no cache (versão ${version}), base ${base}`);
