// 予約ノート（個） service worker
// アプリを更新したら VERSION の数字を1つ上げてください
const VERSION = "v15";
const PREFIX = "yoyaku-note-ko-";
const CACHE = PREFIX + VERSION;
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const ROOT = new URL("./", self.registration.scope).pathname;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  // このアプリの古い保存だけを消す（同じサイトの別アプリの保存は消さない）
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  // スクショの「共有」で予約ノートが選ばれたとき：画像を一時保存して、画面に読み取りを頼む
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData(), files = fd.getAll("img").filter(f => f && f.size);
        const name = "yoyaku-share:" + ROOT; await caches.delete(name); const c = await caches.open(name);
        await Promise.all(files.map((f, i) => c.put("./shared-" + i, new Response(f, {headers: {"content-type": f.type || "image/png", "x-time": String(f.lastModified || Date.now() + i)}}))));
      } catch (err) {}
      return Response.redirect(ROOT + "?shared=1", 303);
    })());
    return;
  }
  if (req.method !== "GET") return;
  const path = new URL(req.url).pathname;
  // スクショ読み取りの部品（cdn.jsdelivr.net）：一度読んだら端末に残して、電波がなくても使えるように
  if (new URL(req.url).hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.open("yoyaku-note-ocr").then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone()); return res;
    }))));
    return;
  }
  if (!path.startsWith(ROOT)) return;
  if (req.mode === "navigate") {
    if (path !== ROOT && path !== ROOT + "index.html") return;
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
