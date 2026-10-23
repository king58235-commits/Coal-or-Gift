'use strict';
// ============================================================
//  入口頁:全版靜態圖片背景輪播 + 飄雪 + 本機排行榜
//
//  背景圖放在 assets/bg/(說明見該資料夾的 README.txt)。
//  之後換成正式圖時,把檔名填進下面的 BG_IMAGES 即可(可刪掉暫代圖)。
//  每個項目可以是字串,或 { src, pos }:pos 是手機直式時畫面對準的位置,例如 '30% 50%'。
// ============================================================
const BG_IMAGES = [
  { src: 'assets/bg/bg-01_barbell.jpg', pos: '18% 50%' },
  { src: 'assets/bg/bg-02_sleigh.jpg', pos: '88% 70%' },
  { src: 'assets/bg/bg-03_armwrestle.jpg', pos: '50% 50%' },
  { src: 'assets/bg/bg-04_tree_squat.jpg', pos: '50% 55%' },
  { src: 'assets/bg/bg-05_sack.jpg', pos: '70% 40%' },
  { src: 'assets/bg/bg-06_selfie.jpg', pos: '72% 50%' },
  { src: 'assets/bg/bg-07_disco.jpg', pos: '22% 70%' },
  { src: 'assets/bg/bg-08_shaker.jpg', pos: '78% 50%' },
  { src: 'assets/bg/bg-09_yeti.jpg', pos: '50% 50%' },
  { src: 'assets/bg/bg-10_snowman_hide.jpg', pos: '60% 65%' },
  { src: 'assets/bg/bg-11_peak.jpg', pos: '50% 75%' },
  { src: 'assets/bg/bg-12_hottub.jpg', pos: '38% 50%' },
];
const HOLD_MS = 6000;   // 每張停留時間(含淡入淡出)

const TAGLINES = [
  '好孩子收禮物,壞孩子吃煤炭,偽裝的老人吃肌肉',
  '今年的聖誕老人,是練過的',
  '據說他的二頭肌比禮物袋還大',
  '不是所有小孩都是小孩,小心他戴著毛帽',
  '雪怪來襲?沒關係,煤炭管夠',
];
const TICKER = ['🎁 聖誕老人今年改走健身路線', '⚫ 煤炭庫存充足,壞孩子請放心', '💪 目擊肌肉聖誕老人偽裝成小孩,請勿靠近', '❄ 雪怪最近情緒不穩定', '🏆 排行榜前五名可獲得:沒有任何東西'];

// ---------- 排行榜 ----------
function renderBoard() {
  const ol = document.getElementById('board'), rows = Scores.load();
  ol.innerHTML = '';
  if (!rows.length) {
    ol.innerHTML = '<li class="empty" style="display:block">還沒有紀錄,快去發禮物!</li>';
  } else {
    rows.forEach((e, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="rk">' + ['🥇', '🥈', '🥉', '④', '⑤'][i] + '</span>' +
        '<span class="sc">' + e.score.toLocaleString() + '</span>' +
        '<span class="meta">連擊 ' + e.combo + '<br>' + Scores.fmtTime(e.secs) + ' · ' + Scores.fmtDate(e.date) + '</span>';
      ol.appendChild(li);
    });
  }
  document.getElementById('clear').hidden = !rows.length;
}
document.getElementById('clear').addEventListener('click', () => {
  if (confirm('確定要清除本機的歷史排行榜嗎?')) { Scores.clear(); renderBoard(); }
});
renderBoard();

// ---------- 跑馬燈 / 標語 ----------
document.getElementById('runline').innerHTML = [...TICKER, ...TICKER].map(t => '<span>' + t + '</span>').join('');
const tagEl = document.getElementById('tag');
let tagI = 0;
tagEl.textContent = TAGLINES[0];
setInterval(() => {
  tagEl.style.opacity = 0;
  setTimeout(() => { tagI = (tagI + 1) % TAGLINES.length; tagEl.textContent = TAGLINES[tagI]; tagEl.style.opacity = 1; }, 350);
}, 3400);
addEventListener('keydown', e => { if (e.key === 'Enter') location.href = 'game.html'; });

// ---------- 背景圖輪播:隨機順序(洗牌後輪完一輪才重洗,且不會連續出現同一張) ----------
(function slideshow() {
  const layers = [document.getElementById('bgA'), document.getElementById('bgB')];
  const items = BG_IMAGES.map(it => typeof it === 'string' ? { src: it, pos: 'center' } : { pos: 'center', ...it });
  const ok = [];   // 載入成功的圖
  let bag = [], lastItem = null, front = 0, started = false;

  function nextItem() {
    if (!bag.length) {
      bag = ok.slice().sort(() => Math.random() - 0.5);
      if (bag.length > 1 && bag[0] === lastItem) bag.push(bag.shift());   // 換輪時避免和上一張重複
    }
    return bag.shift();
  }
  function show() {
    if (!ok.length) return;
    const it = nextItem(); lastItem = it;
    const nxt = layers[front ^ 1], cur = layers[front];
    nxt.style.backgroundImage = `url("${it.src}")`;
    nxt.style.backgroundPosition = it.pos;
    nxt.classList.remove('on'); void nxt.offsetWidth;   // 重新觸發慢速推近動畫
    nxt.classList.add('on');
    cur.classList.remove('on');
    front ^= 1;
  }
  items.forEach(it => {
    const im = new Image();
    im.onload = () => {
      ok.push(it);
      if (!started) { started = true; show(); setInterval(show, HOLD_MS); }
    };
    im.onerror = () => console.warn('背景圖載入失敗,已略過:', it.src);
    im.src = it.src;
  });
})();

// ---------- 飄雪(輕量,疊在圖片上) ----------
const fx = document.getElementById('fx'), fg = fx.getContext('2d');
let FW = 0, FH = 0;
function fit() { FW = fx.width = innerWidth; FH = fx.height = innerHeight; }
addEventListener('resize', fit); fit();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flakes = Array.from({ length: reduce ? 0 : 90 }, () => ({ x: Math.random() * 2000, y: Math.random() * 1200, z: 0.4 + Math.random(), p: Math.random() * 6 }));
let T = 0, lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; T += dt;
  fg.clearRect(0, 0, FW, FH);
  fg.fillStyle = '#fff';
  for (const f of flakes) {
    f.y += (24 + 40 * f.z) * dt; f.x += Math.sin(T * 0.8 + f.p) * 12 * dt;
    if (f.y > FH + 6) { f.y = -6; f.x = Math.random() * FW; }
    fg.globalAlpha = 0.35 + 0.4 * f.z / 1.4; fg.beginPath(); fg.arc(f.x % FW, f.y, 1.4 * f.z + 0.6, 0, Math.PI * 2); fg.fill();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
