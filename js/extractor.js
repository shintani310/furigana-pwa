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

  // 遅延読み込み属性を src に昇格させる
  // 多くのサイトが <img src="placeholder.gif" data-src="本物.jpg" loading="lazy"> 形式
  // Readability は data-* を認識しないので、事前に書き換える必要がある
  function unlazyImages(root) {
    const LAZY_SRC_ATTRS = [
      'data-src', 'data-lazy-src', 'data-original', 'data-original-src',
      'data-actual-src', 'data-defer-src', 'data-echo', 'data-img-src',
    ];
    const LAZY_SRCSET_ATTRS = [
      'data-srcset', 'data-lazy-srcset', 'data-original-srcset',
    ];

    root.querySelectorAll('img, source').forEach(el => {
      // src の昇格
      const currentSrc = el.getAttribute('src') || '';
      const isPlaceholder = !currentSrc ||
        /^data:/.test(currentSrc) ||
        /placeholder|blank|spacer|1x1|loading/i.test(currentSrc);
      for (const attr of LAZY_SRC_ATTRS) {
        const v = el.getAttribute(attr);
        if (v && (isPlaceholder || !el.getAttribute('src'))) {
          el.setAttribute('src', v);
          break;
        }
      }
      // srcset の昇格
      if (!el.getAttribute('srcset')) {
        for (const attr of LAZY_SRCSET_ATTRS) {
          const v = el.getAttribute(attr);
          if (v) {
            el.setAttribute('srcset', v);
            break;
          }
        }
      }
      // loading="lazy" は描画後すぐ読みに行きたいので外す
      if (el.getAttribute('loading') === 'lazy') {
        el.removeAttribute('loading');
      }
      // ホットリンク防止対策: Referer を送らない
      if (el.tagName === 'IMG' && !el.hasAttribute('referrerpolicy')) {
        el.setAttribute('referrerpolicy', 'no-referrer');
      }
    });

    // <noscript> 内に本物の <img> が入っているパターン（はてなブログ等）
    root.querySelectorAll('noscript').forEach(ns => {
      const html = ns.textContent || ns.innerHTML;
      if (/<img\s/i.test(html)) {
        const tmpl = document.createElement('template');
        tmpl.innerHTML = html;
        const realImg = tmpl.content.querySelector('img');
        if (realImg) {
          const prev = ns.previousElementSibling;
          // 直前の img がプレースホルダ風なら置き換え
          if (prev && prev.tagName === 'IMG') {
            prev.replaceWith(realImg.cloneNode(true));
          } else {
            ns.replaceWith(realImg.cloneNode(true));
          }
        }
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

    // Readability に渡す前に lazy 画像を src に昇格させる
    // （Readability は data-* 属性を認識しないため）
    unlazyImages(doc);

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

    // Readability が data-* を落としている可能性があるので念のため再実行
    unlazyImages(container);
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
