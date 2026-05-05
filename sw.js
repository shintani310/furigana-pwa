// 一時的な「自己削除SW」: 古いSWを確実にクリアするため
// 1回有効化されると、すべてのキャッシュを削除し、自分自身を unregister する
// ※ 動作確認後、本来の SW (v7) に置き換える予定

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 全キャッシュを削除
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // 自分自身を unregister
      await self.registration.unregister();
      // 開いているタブをリロードして最新リソースを取りに行かせる
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});

// fetch ハンドラを置かない => すべてのリクエストはネットワークに直行
