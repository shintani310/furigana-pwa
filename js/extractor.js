// プロキシ経由でURL先のHTMLを取り、Readability で本文を抽出
window.Extractor = (function () {
  'use strict';

  // Cloudflare Workers のCORSプロキシURL
  // ローカル開発時は wrangler dev のURL（例: http://127.0.0.1:8787/）でも可
  const PROXY_BASE = 'https://furigana-proxy.furigana-reader.workers.dev/';

  function buildProxyUrl(targetUrl) {
    return `${PROXY_BASE}?url=${encodeURIComponent(targetUrl)}`;
  }

  async function fetchHtml(targetUrl) {
    const res = await fetch(buildProxyUrl(targetUrl));
    if (!res.ok) {
      throw new Error(`プロキシ取得エラー (${res.status}): ${res.statusText}`);
    }
    return await res.text();
  }

  // 相対URLを絶対化（src / href / srcset）
  function absolutizeUrls(container, baseUrl) {
    const ATTRS = ['src', 'href'];
    container.querySelectorAll('img, a, source, audio, video, link').forEach(el => {
      for (const attr of ATTRS) {
        const v = el.getAttribute(attr);
        if (v && !/^(https?:|data:|mailto:|tel:|#)/i.test(v)) {
          try { el.setAttribute(attr, new URL(v, baseUrl).href); } catch { /* noop */ }
        }
      }
      // srcset は複数URL含む
      const srcset = el.getAttribute('srcset');
      if (srcset) {
        try {
          const newSrcset = srcset.split(',').map(part => {
            const trimmed = part.trim();
            const [url, ...rest] = trimmed.split(/\s+/);
            if (!url || /^(https?:|data:)/i.test(url)) return trimmed;
            return [new URL(url, baseUrl).href, ...rest].join(' ');
          }).join(', ');
          el.setAttribute('srcset', newSrcset);
        } catch { /* noop */ }
      }
    });
  }

  // 本文抽出: { title, container } を返す
  async function extractContent(targetUrl) {
    const html = await fetchHtml(targetUrl);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // base要素で相対URL解決
    if (!doc.querySelector('base')) {
      const b = doc.createElement('base');
      b.href = targetUrl;
      doc.head.prepend(b);
    }

    if (typeof Readability === 'undefined') {
      throw new Error('Readability ライブラリが読み込めていません');
    }

    // Readability は DOM を破壊するので clone を渡すのが安全
    const docClone = doc.cloneNode(true);
    const article = new Readability(docClone).parse();

    const container = document.createElement('div');
    let title;

    if (article && article.content) {
      container.innerHTML = article.content;
      title = article.title || doc.title || targetUrl;
    } else {
      // Readability 失敗時のフォールバック: body をそのまま使う
      console.warn('Readability failed, falling back to body');
      const body = doc.body;
      if (body) container.innerHTML = body.innerHTML;
      title = doc.title || targetUrl;
    }

    absolutizeUrls(container, targetUrl);

    // 危険な要素を除去
    container.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());

    return { title, container };
  }

  return {
    extractContent,
    PROXY_BASE,
  };
})();
