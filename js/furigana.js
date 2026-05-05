// Kuroshiro 初期化 + DOMふりがな付加 + 学年フィルタ
window.Furigana = (function () {
  'use strict';

  // 辞書はjsDelivrから取得（CORS対応済み）
  const DICT_URL = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';

  // 教育漢字外の漢字を表す番外学年（常にふりがな表示）
  const UNKNOWN_GRADE = 99;

  // UMDビルドの差異を吸収
  function resolveCtor(globalObj) {
    if (!globalObj) return null;
    return globalObj.default || globalObj;
  }

  let initPromise = null;
  let kuroshiroInst = null;

  function init() {
    if (initPromise) return initPromise;
    const KuroshiroCtor = resolveCtor(window.Kuroshiro);
    const AnalyzerCtor = resolveCtor(window.KuromojiAnalyzer);
    if (!KuroshiroCtor || !AnalyzerCtor) {
      return Promise.reject(new Error('Kuroshiro / KuromojiAnalyzer が読み込めていません'));
    }
    initPromise = (async () => {
      console.log('[Furigana] init start, dictPath =', DICT_URL);
      const t0 = Date.now();
      kuroshiroInst = new KuroshiroCtor();
      try {
        await kuroshiroInst.init(new AnalyzerCtor({ dictPath: DICT_URL }));
        console.log('[Furigana] init done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
      } catch (e) {
        console.error('[Furigana] init failed:', e);
        throw e;
      }
    })();
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

  // ruby に data-max-grade を付与
  // base text 内の漢字で最も学年が高い値（教育漢字外があれば UNKNOWN_GRADE）
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
        // ふりがなが付いた断片内の各 ruby に学年マークを付ける
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

  // 学年フィルタ: 削除せず class で表示制御（再切替可能）
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
