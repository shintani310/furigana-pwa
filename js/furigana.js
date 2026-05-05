// Kuroshiro 初期化 + DOMふりがな付加 + 学年フィルタ
window.Furigana = (function () {
  'use strict';

  // kuromoji.js の dict ローダーは絶対URLを正しく扱えない（プロトコル落ちの問題）
  // ため、自サイトに同梱して相対パスで指定する
  const DICT_URL = './dict/';
  const INIT_TIMEOUT_MS = 90 * 1000; // 90秒で諦める
  const UNKNOWN_GRADE = 99;

  function resolveCtor(globalObj) {
    if (!globalObj) return null;
    return globalObj.default || globalObj;
  }

  let initPromise = null;
  let kuroshiroInst = null;

  function initInner() {
    return new Promise(function (resolve, reject) {
      const KuroshiroCtor = resolveCtor(window.Kuroshiro);
      const AnalyzerCtor = resolveCtor(window.KuromojiAnalyzer);
      console.log('[Furigana] globals check:', {
        Kuroshiro: !!window.Kuroshiro,
        KuromojiAnalyzer: !!window.KuromojiAnalyzer,
        kuromoji: !!window.kuromoji,
        Readability: typeof Readability !== 'undefined',
      });
      if (!KuroshiroCtor) {
        return reject(new Error('Kuroshiro が読み込めていません（CDN取得失敗の可能性）'));
      }
      if (!AnalyzerCtor) {
        return reject(new Error('KuromojiAnalyzer が読み込めていません（CDN取得失敗の可能性）'));
      }

      console.log('[Furigana] init start, dictPath =', DICT_URL);
      const t0 = Date.now();

      const timer = setTimeout(function () {
        reject(new Error(
          'ふりがな辞書の読み込みに ' + (INIT_TIMEOUT_MS / 1000) + ' 秒以上かかりました。' +
          '通信状況を確認してから再度お試しください。'
        ));
      }, INIT_TIMEOUT_MS);

      try {
        kuroshiroInst = new KuroshiroCtor();
        kuroshiroInst
          .init(new AnalyzerCtor({ dictPath: DICT_URL }))
          .then(function () {
            clearTimeout(timer);
            console.log('[Furigana] init done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
            resolve();
          })
          .catch(function (e) {
            clearTimeout(timer);
            console.error('[Furigana] analyzer init failed:', e);
            reject(e);
          });
      } catch (e) {
        clearTimeout(timer);
        console.error('[Furigana] sync exception:', e);
        reject(e);
      }
    });
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = initInner().catch(function (e) {
      // 失敗時は次回再試行できるよう promise を破棄
      initPromise = null;
      throw e;
    });
    return initPromise;
  }

  function collectTextNodes(root) {
    const SKIP = 'ruby, rt, rp, script, style, noscript, code, pre, textarea';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        return /[一-龯々]/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    const list = [];
    let n;
    while ((n = walker.nextNode())) list.push(n);
    return list;
  }

  function extractRubyBase(ruby) {
    let base = '';
    ruby.childNodes.forEach(ch => {
      if (ch.nodeType === Node.TEXT_NODE) base += ch.nodeValue;
      else if (ch.nodeType === Node.ELEMENT_NODE && !['RT', 'RP'].includes(ch.tagName)) {
        base += ch.textContent;
      }
    });
    return base;
  }

  function annotateRuby(ruby, kanjiGrades) {
    const base = extractRubyBase(ruby);
    let maxGrade = 0;
    let hasUnknown = false;
    for (const ch of base) {
      if (!/[一-龯々]/.test(ch)) continue;
      const g = kanjiGrades[ch];
      if (!g) { hasUnknown = true; break; }
      if (g > maxGrade) maxGrade = g;
    }
    ruby.dataset.maxGrade = String(hasUnknown ? UNKNOWN_GRADE : (maxGrade || UNKNOWN_GRADE));
  }

  async function addFuriganaToDOM(root, kanjiGrades, onProgress) {
    await init();
    const targets = collectTextNodes(root);
    const total = targets.length;
    if (onProgress) onProgress(0, total);

    for (let i = 0; i < total; i++) {
      const node = targets[i];
      try {
        const html = await kuroshiroInst.convert(node.nodeValue, {
          mode: 'furigana',
          to: 'hiragana',
        });
        const tmpl = document.createElement('template');
        tmpl.innerHTML = html;
        tmpl.content.querySelectorAll('ruby').forEach(r => annotateRuby(r, kanjiGrades));
        node.replaceWith(tmpl.content);
      } catch (e) {
        console.warn('furigana convert failed:', e, 'text:', node.nodeValue);
      }
      if (onProgress && (i % 8 === 0 || i === total - 1)) {
        onProgress(i + 1, total);
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }

  function applyGradeFilter(root, gradeLimit) {
    root.querySelectorAll('ruby').forEach(ruby => {
      const max = parseInt(ruby.dataset.maxGrade, 10) || UNKNOWN_GRADE;
      ruby.classList.toggle('learned', max > 0 && max <= gradeLimit);
    });
  }

  return {
    init,
    addFuriganaToDOM,
    applyGradeFilter,
  };
})();
