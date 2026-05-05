// 履歴・お気に入り・設定のlocalStorageラッパー
window.Storage = (function () {
  'use strict';

  const KEY_GRADE = 'fr.grade';
  const KEY_HISTORY = 'fr.history';
  const KEY_FAVORITES = 'fr.favorites';
  const HISTORY_MAX = 30;
  const FAVORITES_MAX = 50;
  const DEFAULT_GRADE = 3;

  function readJson(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (!v) return fallback;
      const parsed = JSON.parse(v);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  }

  // ---- 学年 ----
  function getGrade() {
    const v = parseInt(localStorage.getItem(KEY_GRADE), 10);
    return v >= 1 && v <= 6 ? v : DEFAULT_GRADE;
  }
  function setGrade(g) {
    const c = Math.min(6, Math.max(1, parseInt(g, 10) || DEFAULT_GRADE));
    localStorage.setItem(KEY_GRADE, String(c));
  }

  // ---- 共通: URLを正規化（同じURLを別物として記録しないため） ----
  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      // フラグメントは除く（同じページの別アンカーは同一ページとして扱う）
      u.hash = '';
      return u.href;
    } catch {
      return url;
    }
  }

  // ---- 履歴 ----
  function getHistory() {
    const list = readJson(KEY_HISTORY, []);
    return Array.isArray(list) ? list : [];
  }
  function addHistory(entry) {
    if (!entry || !entry.url) return;
    const url = normalizeUrl(entry.url);
    const item = {
      url,
      title: entry.title || url,
      ts: Date.now(),
    };
    const list = getHistory().filter((x) => x.url !== url);
    list.unshift(item);
    writeJson(KEY_HISTORY, list.slice(0, HISTORY_MAX));
  }
  function removeHistory(url) {
    const target = normalizeUrl(url);
    writeJson(KEY_HISTORY, getHistory().filter((x) => x.url !== target));
  }
  function clearHistory() {
    writeJson(KEY_HISTORY, []);
  }

  // ---- お気に入り ----
  function getFavorites() {
    const list = readJson(KEY_FAVORITES, []);
    return Array.isArray(list) ? list : [];
  }
  function isFavorite(url) {
    const target = normalizeUrl(url);
    return getFavorites().some((x) => x.url === target);
  }
  function addFavorite(entry) {
    if (!entry || !entry.url) return false;
    const url = normalizeUrl(entry.url);
    const list = getFavorites();
    if (list.some((x) => x.url === url)) return false;
    list.unshift({ url, title: entry.title || url, ts: Date.now() });
    writeJson(KEY_FAVORITES, list.slice(0, FAVORITES_MAX));
    return true;
  }
  function removeFavorite(url) {
    const target = normalizeUrl(url);
    writeJson(KEY_FAVORITES, getFavorites().filter((x) => x.url !== target));
  }
  function toggleFavorite(entry) {
    if (!entry || !entry.url) return false;
    if (isFavorite(entry.url)) {
      removeFavorite(entry.url);
      return false;
    } else {
      addFavorite(entry);
      return true;
    }
  }

  return {
    getGrade,
    setGrade,
    getHistory,
    addHistory,
    removeHistory,
    clearHistory,
    getFavorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    normalizeUrl,
  };
})();
