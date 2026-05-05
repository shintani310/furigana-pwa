# ふりがなリーダー（フェーズ1）

子供がWebページを読みやすくするための家族用ツール。任意のURLを入れると、本文を抽出して漢字にふりがなを付けて表示します。

## できること（フェーズ1）

- URLを入力 → 本文抽出（Mozilla Readability） → 漢字にふりがな付与（Kuroshiro+Kuromoji）
- 学年（1〜6年）を選ぶと、その学年までに習う漢字のふりがなを非表示にできる
- 学年設定はブラウザに保存される
- スマホ優先のUI、大きい文字・広い行間
- 元ページへのリンクも表示

## まだないもの（フェーズ2以降）

- ホーム画面に追加（PWA化）
- 履歴・お気に入り
- 完全コピーモード
- オフライン起動

## 使い方（ローカルで試す）

1. **CORSプロキシをデプロイ**（[cloudflare-worker/README.md](./cloudflare-worker/README.md) 参照）
2. **`js/extractor.js` の `PROXY_BASE` を実際のWorker URLに書き換え**
3. **`cloudflare-worker/index.js` の `ALLOWED_ORIGINS` に自分のURLを記入**
4. ローカルサーバを起動:
   ```bash
   cd /path/to/ふりがなPWA_AIワークスペース
   python3 -m http.server 8080
   ```
5. ブラウザで `http://localhost:8080/` を開く
6. URLを入れて「ふりがなをつけて読む ▶」

## 公開（GitHub Pages）

```bash
cd /path/to/ふりがなPWA_AIワークスペース
git init
git add .
git commit -m "phase1: ふりがなリーダー初版"
git branch -M main
# GitHubでリポジトリを作成（例: furigana-reader）してから
git remote add origin https://github.com/<あなたのID>/furigana-reader.git
git push -u origin main
# Settings > Pages > Source: Deploy from a branch / main / / (root)
# 数分後 https://<あなたのID>.github.io/furigana-reader/ で公開
```

## ファイル構成

```
.
├── index.html                # ホーム画面
├── viewer.html               # 閲覧画面
├── css/style.css             # スタイル
├── js/
│   ├── app.js                # ホーム画面ロジック
│   ├── viewer.js             # 閲覧画面コントローラー
│   ├── furigana.js           # Kuroshiro + 学年フィルタ
│   └── extractor.js          # Readability ラッパー（PROXY_BASE 要編集）
├── data/kanji-grades.json    # 教育漢字1006字 → 学年マップ
└── cloudflare-worker/        # CORSプロキシ（別途wranglerでデプロイ）
    ├── index.js              # ALLOWED_ORIGINS 要編集
    ├── wrangler.toml
    └── README.md
```

## 既知の制約

- **長いページ**: ふりがな処理に時間がかかる（10〜30秒）。進捗表示あり。
- **Bot対策が厳しいサイト**: 一部のサイト（Cloudflare Bot Management 等）はWorker経由のfetchを拒否します。
- **ふりがな精度**: 固有名詞・ゲーム用語は誤読することがあります（要件通り許容）。
- **教育漢字外の漢字**: kanjiapi.dev の1006字版を採用（2020年改訂前）。県名漢字（茨・媛など20字）は常にふりがな付き扱い。
