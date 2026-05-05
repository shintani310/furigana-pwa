// ふりがなリーダー Service Worker
// アプリシェル(Cache First) + 辞書(別キャッシュ) + プロキシ(NetworkOnly)

const SHELL_CACHE = 'fr-shell-v2';
const DICT_CACHE = 'fr-dict-v1';

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

// 外部CDN（Kuroshiro/Readability/辞書）はjsDelivr。SWは触らずブラウザに任せる
const DICT_URL_PREFIX = 'https://cdn.jsdelivr.net/npm/kuromoji@';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      // 個別にfetchして失敗してもインストール継続（ローカル/Pages両対応）
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
        keys
          .filter((k) => ![SHELL_CACHE, DICT_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // kuromoji辞書: 別キャッシュにCacheFirst
  if (url.href.startsWith(DICT_URL_PREFIX)) {
    e.respondWith(
      caches.open(DICT_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          // 取得失敗時にキャッシュがあれば返す
          if (hit) return hit;
          throw err;
        }
      })
    );
    return;
  }

  // 同一オリジンの静的リソース: CacheFirst
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          // 成功したら追加でキャッシュ（HTML/JS/CSSなど）
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        }).catch(() => {
          // ネットなしでアプリシェルは動かしたい → index.htmlで代用
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }

  // それ以外（CDN script、CORSプロキシ）はSWを介さず通常fetch
});
