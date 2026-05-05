# Cloudflare Workers CORSプロキシ

ふりがなリーダーで使うCORSプロキシです。

## デプロイ手順

```bash
# 1. wrangler を入れる（初回のみ）
npm install -g wrangler

# 2. Cloudflare アカウントでログイン
wrangler login

# 3. このディレクトリでデプロイ
cd cloudflare-worker
wrangler deploy
```

デプロイ後、以下のようなURLが表示されます:
```
https://furigana-proxy.<あなたのCFサブドメイン>.workers.dev
```

## デプロイ後の設定

1. `index.js` の `ALLOWED_ORIGINS` を自分のGitHub Pages URLに書き換えてください:
   ```js
   const ALLOWED_ORIGINS = [
     'https://YOUR-GITHUB-ID.github.io',
     'http://localhost:8080',
     'http://127.0.0.1:8080',
     'http://localhost:5173',
   ];
   ```

2. プロジェクトルートの `js/extractor.js` の `PROXY_BASE` をこのURLに書き換える:
   ```js
   const PROXY_BASE = 'https://furigana-proxy.<あなたのCFサブドメイン>.workers.dev/';
   ```

3. 修正後、再度 `wrangler deploy` を実行（worker側のORIGINS変更を反映）。

## ローカルで試す

```bash
wrangler dev
```

`http://127.0.0.1:8787/?url=https://example.com` で動作確認できます。
ローカル開発時は `extractor.js` の `PROXY_BASE` を `http://127.0.0.1:8787/` に一時的に書き換えてください。

## 動作確認

```bash
curl "https://furigana-proxy.<sub>.workers.dev/?url=https://example.com" | head -c 200
```
HTMLが返ってきたらOK。
