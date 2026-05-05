// 完全コピーモード: 元ページのHTMLをほぼそのまま保ったうえでふりがなを付ける
// iframe srcdoc にレンダリング。元サイトのCSSは <base> 経由で読み込ませる
window.FullCopy = (function () {
  'use strict';

  // 学年フィルタを iframe 内で切替えるためのスクリプト（文字列）
  const FILTER_SCRIPT = `
(function(){
  var UNKNOWN_GRADE = 99;
  function applyGrade(g){
    document.querySelectorAll('ruby').forEach(function(ruby){
      var max = parseInt(ruby.dataset.maxGrade, 10) || UNKNOWN_GRADE;
      ruby.classList.toggle('learned', max > 0 && max <= g);
    });
  }
  window.__applyGrade = applyGrade;
  if (typeof window.__initialGrade === 'number') applyGrade(window.__initialGrade);
})();
`;

  const FILTER_STYLE = `
ruby { ruby-position: over; ruby-align: center; }
rt { font-size: 0.55em; color: #666; font-weight: normal; letter-spacing: 0; }
ruby.learned rt, ruby.learned rp { display: none; }
`;

  function buildProxyUrl(targetUrl) {
    return window.Extractor.PROXY_BASE + '?url=' + encodeURIComponent(targetUrl);
  }

  // ページをfetchし、ふりがなを付加してiframeに描画
  async function load(targetUrl, kanjiGrades, gradeLimit, iframeEl, onProgress) {
    if (onProgress) onProgress({ phase: 'fetch' });
    const res = await fetch(buildProxyUrl(targetUrl));
    if (!res.ok) throw new Error('プロキシエラー (' + res.status + ')');
    const html = await res.text();

    if (onProgress) onProgress({ phase: 'parse' });
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // タイトル取得
    const title = (doc.title || targetUrl).trim();

    // base要素で相対URL解決（元サイトのCSS/画像を取りに行く）
    const existingBase = doc.querySelector('base');
    if (existingBase) existingBase.remove();
    const base = doc.createElement('base');
    base.href = targetUrl;
    if (doc.head) doc.head.prepend(base);

    // 安全のためインラインスクリプト/iframe/object/embed を全部削除
    doc.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
    // on*属性も剥がす（onclick等）
    doc.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });

    // ふりがなを付加（body配下）
    if (onProgress) onProgress({ phase: 'furigana', done: 0, total: 1 });
    if (doc.body) {
      await window.Furigana.addFuriganaToDOM(doc.body, kanjiGrades, (done, total) => {
        if (onProgress) onProgress({ phase: 'furigana', done, total });
      });
    }

    // 学年フィルタCSS + 切替スクリプトを注入
    const styleEl = doc.createElement('style');
    styleEl.textContent = FILTER_STYLE;
    if (doc.head) doc.head.appendChild(styleEl);

    const initScript = doc.createElement('script');
    initScript.textContent = 'window.__initialGrade = ' + gradeLimit + ';';
    if (doc.head) doc.head.appendChild(initScript);

    const filterScriptEl = doc.createElement('script');
    filterScriptEl.textContent = FILTER_SCRIPT;
    if (doc.body) doc.body.appendChild(filterScriptEl);

    if (onProgress) onProgress({ phase: 'render' });
    const serialized = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    iframeEl.srcdoc = serialized;

    return { title };
  }

  // 学年変更時に iframe 内のフィルタを切替える
  function applyGrade(iframeEl, gradeLimit) {
    try {
      const win = iframeEl.contentWindow;
      if (win && typeof win.__applyGrade === 'function') {
        win.__applyGrade(gradeLimit);
      }
    } catch (e) {
      console.warn('iframe grade apply failed:', e);
    }
  }

  return { load, applyGrade };
})();
