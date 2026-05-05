// 閲覧画面コントローラー
(function () {
  'use strict';

  const DEFAULT_GRADE = 3;
  const KANJI_GRADES_URL = './data/kanji-grades.json';

  const els = {
    title: document.getElementById('title'),
    sourceLink: document.getElementById('source-link'),
    backBtn: document.getElementById('back-btn'),
    favBtn: document.getElementById('fav-btn'),
    gradeRow: document.getElementById('grade-row'),
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    content: document.getElementById('content'),
  };

  const params = new URLSearchParams(location.search);
  const targetUrl = params.get('url');
  const initialGrade = clampGrade(
    parseInt(params.get('grade'), 10) ||
    (window.Storage ? window.Storage.getGrade() : DEFAULT_GRADE)
  );

  let kanjiGrades = null;
  let currentGrade = initialGrade;
  let pageTitle = '';

  function clampGrade(g) {
    return Math.min(6, Math.max(1, isFinite(g) ? g : DEFAULT_GRADE));
  }

  function setStatus(text, options) {
    options = options || {};
    if (!els.status) return;
    if (text === null) {
      els.status.hidden = true;
      return;
    }
    els.status.hidden = false;
    els.status.classList.toggle('error', !!options.error);
    els.statusText.textContent = text;
    const spinner = els.status.querySelector('.spinner');
    if (spinner) spinner.style.display = options.error ? 'none' : '';
  }

  function updateGradeUI(g) {
    els.gradeRow.querySelectorAll('.grade-btn').forEach((btn) => {
      const btnGrade = parseInt(btn.dataset.grade, 10);
      btn.classList.toggle('active', btnGrade === g);
      btn.setAttribute('aria-checked', btnGrade === g ? 'true' : 'false');
    });
  }

  function changeGrade(g) {
    g = clampGrade(g);
    currentGrade = g;
    if (window.Storage) window.Storage.setGrade(g);
    updateGradeUI(g);
    if (kanjiGrades && els.content && !els.content.hidden) {
      window.Furigana.applyGradeFilter(els.content, g);
    }
  }

  function updateFavButton() {
    if (!targetUrl || !window.Storage) return;
    const isFav = window.Storage.isFavorite(targetUrl);
    els.favBtn.textContent = isFav ? '⭐' : '☆';
    els.favBtn.classList.toggle('is-fav', isFav);
    els.favBtn.setAttribute(
      'aria-label',
      isFav ? 'お気に入りから外す' : 'お気に入りに追加'
    );
  }

  els.backBtn.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = './index.html';
  });

  els.gradeRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.grade-btn');
    if (!btn) return;
    changeGrade(parseInt(btn.dataset.grade, 10));
  });

  els.favBtn.addEventListener('click', () => {
    if (!targetUrl || !window.Storage) return;
    window.Storage.toggleFavorite({ url: targetUrl, title: pageTitle || targetUrl });
    updateFavButton();
  });

  if (targetUrl) {
    els.sourceLink.href = targetUrl;
  }

  async function main() {
    if (!targetUrl) {
      setStatus('URLが指定されていません', { error: true });
      return;
    }

    updateGradeUI(currentGrade);
    updateFavButton();

    try {
      setStatus('準備中…');
      const kanjiPromise = fetch(KANJI_GRADES_URL).then((r) => r.json());

      setStatus('ページを取得中…');
      const { title, container } = await window.Extractor.extractContent(targetUrl);
      pageTitle = title || targetUrl;
      document.title = `${pageTitle} - ふりがなリーダー`;
      els.title.textContent = pageTitle;

      // 取得成功した時点で履歴に追加（お気に入りボタンも反映）
      if (window.Storage) {
        window.Storage.addHistory({ url: targetUrl, title: pageTitle });
        updateFavButton();
      }

      kanjiGrades = await kanjiPromise;

      setStatus('ふりがなを準備中…（はじめて使うときは少し時間がかかります）');
      await window.Furigana.init();

      els.content.appendChild(container);
      els.content.hidden = false;

      setStatus('ふりがなを付けています… 0%');
      await window.Furigana.addFuriganaToDOM(els.content, kanjiGrades, (done, total) => {
        const pct = total > 0 ? Math.round(100 * done / total) : 100;
        setStatus(`ふりがなを付けています… ${pct}%`);
      });

      window.Furigana.applyGradeFilter(els.content, currentGrade);
      setStatus(null);
    } catch (e) {
      console.error(e);
      setStatus(`読み込みに失敗しました: ${e.message}`, { error: true });
    }
  }

  main();
})();
