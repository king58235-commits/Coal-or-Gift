'use strict';
// 本機歷史排行榜:只存在這台電腦的瀏覽器(localStorage),最多 5 筆最高分。
const Scores = (() => {
  const KEY = 'cog_scores_v1', MAX = 5;

  function load() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(a)) return a.filter(e => e && typeof e.score === 'number').slice(0, MAX);
    } catch (e) {}
    return [];
  }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  // 回傳這筆成績在榜上的名次(0 起算),沒上榜回 -1
  function add(score, combo, secs) {
    if (!(score > 0)) return -1;
    const entry = { score: Math.round(score), combo: combo | 0, secs: Math.round(secs), date: Date.now() };
    const a = load();
    a.push(entry);
    a.sort((x, y) => y.score - x.score || x.date - y.date);   // 同分先到者排前面
    const top = a.slice(0, MAX);
    save(top);
    return top.indexOf(entry);
  }
  function best() { const a = load(); return a.length ? a[0].score : 0; }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function fmtTime(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function fmtDate(ts) { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate(); }

  return { load, add, best, clear, fmtTime, fmtDate, MAX };
})();
