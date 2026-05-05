// ふりがなリーダー Service Worker
// 同一オリジンの静的ファイルのみキャッシュ。
// 外部CDN（jsDelivrの辞書/ライブラリ）とCORSプロキシはSWを通さない。

const SHELL_CACHE = 'fr-shell-v4';

const SHELL_FILES = [
  './',
  './index.html',
  './viewer.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/viewer.js',
  './js/furigana.js',
  './js/extractor.js',
  './js/storage.js',
  './data/kanji-grades.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      Promise.all(
        SHELL_FILES.map((url) =>
          c.add(url).catch((err) => console.warn('SW skip cache:', url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 同一オリジンのみキャッシュファースト
  // 外部リソース（jsDelivr辞書/ライブラリ、Cloudflare Workers）は素通し
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches
              .open(SHELL_CACHE)
              .then((c) => c.put(req, clone))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // ネット断時のSPA的フォールバック
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
