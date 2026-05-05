(function () {
  'use strict';

  const els = {
    gradeRow: document.getElementById('grade-row'),
    form: document.getElementById('url-form'),
    urlInput: document.getElementById('url-input'),
    favCard: document.getElementById('favorites-card'),
    favList: document.getElementById('favorites-list'),
    histCard: document.getElementById('history-card'),
    histList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
  };

  function updateGradeUI(g) {
    els.gradeRow.querySelectorAll('.grade-btn').forEach((btn) => {
      const btnGrade = parseInt(btn.dataset.grade, 10);
      btn.classList.toggle('active', btnGrade === g);
      btn.setAttribute('aria-checked', btnGrade === g ? 'true' : 'false');
    });
  }

  els.gradeRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.grade-btn');
    if (!btn) return;
    const g = parseInt(btn.dataset.grade, 10);
    if (g >= 1 && g <= 6) {
      window.Storage.setGrade(g);
      updateGradeUI(g);
    }
  });

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = els.urlInput.value.trim();
    if (!raw) return;
    let target;
    try {
      const u = new URL(raw);
      if (!/^https?:$/.test(u.protocol)) throw new Error('http/https only');
      target = u.href;
    } catch {
      alert('正しいURLを入れてください（http:// または https:// から始まる）');
      return;
    }
    const grade = window.Storage.getGrade();
    location.href = `./viewer.html?url=${encodeURIComponent(target)}&grade=${grade}`;
  });

  // ---- 履歴・お気に入り表示 ----

  function shortenUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  function buildLinkItem(entry, opts) {
    // <li class="link-item">
    //   <a class="link-main" href="viewer.html?...">
    //     <span class="link-title">title</span>
    //     <span class="link-sub">host/path</span>
    //   </a>
    //   <button class="link-action">⭐ / 🗑</button>
    // </li>
    const grade = window.Storage.getGrade();
    const li = document.createElement('li');
    li.className = 'link-item';

    const a = document.createElement('a');
    a.className = 'link-main';
    a.href = `./viewer.html?url=${encodeURIComponent(entry.url)}&grade=${grade}`;
    const title = document.createElement('span');
    title.className = 'link-title';
    title.textContent = entry.title || entry.url;
    const sub = document.createElement('span');
    sub.className = 'link-sub';
    sub.textContent = shortenUrl(entry.url);
    a.appendChild(title);
    a.appendChild(sub);
    li.appendChild(a);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'link-action';
    btn.setAttribute('aria-label', opts.actionLabel);
    btn.textContent = opts.actionIcon;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onAction(entry);
      renderLists();
    });
    li.appendChild(btn);

    return li;
  }

  function renderLists() {
    // お気に入り
    const favs = window.Storage.getFavorites();
    els.favList.innerHTML = '';
    favs.forEach((entry) => {
      els.favList.appendChild(
        buildLinkItem(entry, {
          actionIcon: '✕',
          actionLabel: 'お気に入りから外す',
          onAction: (en) => window.Storage.removeFavorite(en.url),
        })
      );
    });
    els.favCard.hidden = favs.length === 0;

    // 履歴
    const hist = window.Storage.getHistory();
    els.histList.innerHTML = '';
    hist.forEach((entry) => {
      const isFav = window.Storage.isFavorite(entry.url);
      els.histList.appendChild(
        buildLinkItem(entry, {
          actionIcon: isFav ? '⭐' : '☆',
          actionLabel: isFav ? 'お気に入りから外す' : 'お気に入りに追加',
          onAction: (en) => window.Storage.toggleFavorite(en),
        })
      );
    });
    els.histCard.hidden = hist.length === 0;
    els.clearHistoryBtn.hidden = hist.length === 0;
  }

  els.clearHistoryBtn.addEventListener('click', () => {
    if (confirm('さいきん見たページの履歴を消しますか？\n（お気に入りは消えません）')) {
      window.Storage.clearHistory();
      renderLists();
    }
  });

  // 初期化
  updateGradeUI(window.Storage.getGrade());
  renderLists();
})();
