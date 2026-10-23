'use strict';
// ============================================================
//  煤炭 or 禮物 —— 核心玩法
// ============================================================
const W = 960, H = 540;
const FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let viewScale = 1;

function resize() {
  const aspect = W / H;
  let cw = window.innerWidth, ch = cw / aspect;
  if (ch > window.innerHeight) { ch = window.innerHeight; cw = ch * aspect; }
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  viewScale = canvas.width / W;
}
window.addEventListener('resize', resize);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOutBack = t => { t = clamp(t, 0, 1); const c = 1.8; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ---------------- 狀態 ----------------
let state = 'title';          // title | intro | play | over
let introT = 0, introFx = [false, false];
const INTRO_END = 3.3;
let paused = false;
let time = 0, overT = 0;
let best = 0;
best = Scores.best();

const santa = { x: 480, y: 540, s: 0.85, dir: 1, throwT: -1, item: 'gift', t: 0, flexKick: 0, pose: 'throw', victoryT: 0 };
const mouse = { x: 700, y: 200, down: false };
const targets = [], projectiles = [], particles = [], texts = [], clones = [], spawnHist = [];
let yeti = null, banner = null, bubble = null, muscle = null;
const G = {};

const spots = [];
// 目標位置:全部站在地面上(腳底 y >= 296,地平線在 y≈258;不可以飛在空中),
// 且都在畫面中間區塊(x 約 190~770),左右兩條邊條專門留給分身。
// 分身與目標「區域完全分開」,絕不重疊(見 checkLayout)。同一排左右交錯,前後排互相遮擋是正常的景深。
[[250, 300, .75], [400, 300, .75], [560, 300, .75], [715, 300, .75],
 [200, 372, .9], [320, 372, .9], [640, 372, .9], [760, 372, .9],
 [230, 448, 1.05], [730, 448, 1.05]].forEach(([x, y, s]) => spots.push({ x, y, s, occ: false }));

// 周圍的分身最多 4 個,只站在畫面邊角,避免擋住目標;更高的連擊改由「偽裝聖誕老人」來惡搞
const CLONE_SLOTS = [[80, 540, .5], [880, 540, .5], [60, 380, .36], [900, 380, .36]];
// 分身(含伸出的手臂)與目標的外框;兩者不可相交
const cloneBox = ([x, y, s]) => ({ x0: x - 176 * s, x1: x + 176 * s, y0: y - 322 * s, y1: y });
const spotBox = sp => ({ x0: sp.x - 42 * sp.s, x1: sp.x + 42 * sp.s, y0: sp.y - 130 * sp.s, y1: sp.y + 6 });
const boxHit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
function checkLayout() {
  const bad = [];
  for (const c of CLONE_SLOTS) for (const sp of spots) if (boxHit(cloneBox(c), spotBox(sp))) bad.push('clone' + c + ' x spot(' + sp.x + ',' + sp.y + ')');
  for (const sp of spots) if (sp.y < 296) bad.push('spot(' + sp.x + ',' + sp.y + ') 飛在空中');
  return bad;
}
const CLONE_POSES = ['flex', 'dance', 'disco', 'pump'];

function resetGame() {
  Object.assign(G, {
    score: 0, lives: 3, combo: 0, maxCombo: 0, elapsed: 0, spawnT: 0.8, fever: 0, grace: 0, santaCd: 0, wrong: 0, okStreak: 0,
    yetiCount: 0, yetiCd: 0, flash: 0, flashCol: '#fff', hurt: 0, comboPop: 0, served: 0,
  });
  targets.length = 0; projectiles.length = 0; particles.length = 0; texts.length = 0; clones.length = 0;
  spots.forEach(s => (s.occ = false));
  yeti = null; banner = null; bubble = null; muscle = null; spawnHist.length = 0; G.santaHint = false;
  santa.item = 'gift'; santa.throwT = -1; santa.victoryT = 0;
}
resetGame();

// 雪怪能量條(fever)與連擊分開算:連擊管分身與倍率,能量條管雪怪何時出現
// 丟錯累積 3 次扣一顆愛心;連續打對 10 次可冷卻 1 次失誤
const WRONG_LIMIT = 3;
const yetiThreshold = () => 14 + 3 * Math.min(G.yetiCount, 6);
const getMult = () => Math.min(5, 1 + Math.floor(G.combo / 5) * 0.5);
// 失誤時連擊減半(而不是歸零),能量條打七折
function breakCombo() { G.combo = Math.floor(G.combo / 2); G.fever *= 0.7; }

// ---------------- 背景 ----------------
const bgCanvas = document.createElement('canvas');
bgCanvas.width = W; bgCanvas.height = H;
(function buildBG() {
  const g = bgCanvas.getContext('2d');
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let gr = g.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, '#07102b'); gr.addColorStop(0.6, '#1c3a70'); gr.addColorStop(1, '#4d78ad');
  g.fillStyle = gr; g.fillRect(0, 0, W, 320);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    g.fillRect(rnd() * W, rnd() * 190, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
  }
  // 月亮
  g.fillStyle = 'rgba(255,248,210,.12)'; g.beginPath(); g.arc(800, 70, 70, 0, TAU); g.fill();
  g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(800, 70, 34, 0, TAU); g.fill();
  g.fillStyle = 'rgba(200,190,150,.35)'; g.beginPath(); g.arc(790, 62, 7, 0, TAU); g.arc(812, 82, 5, 0, TAU); g.fill();
  // 遠山
  g.fillStyle = '#5e86bb';
  g.beginPath(); g.moveTo(0, 230); for (let x = 0; x <= W; x += 60) g.lineTo(x, 170 + Math.sin(x * 0.011) * 28 + rnd() * 14); g.lineTo(W, 260); g.lineTo(0, 260); g.fill();
  g.fillStyle = '#7fa4d1';
  g.beginPath(); g.moveTo(0, 240); for (let x = 0; x <= W; x += 50) g.lineTo(x, 205 + Math.cos(x * 0.016) * 20 + rnd() * 10); g.lineTo(W, 270); g.lineTo(0, 270); g.fill();
  // 房子
  const house = (x, w, h, col) => {
    const by = 262;
    g.fillStyle = col; g.fillRect(x, by - h, w, h);
    g.fillStyle = '#3b2a3f'; g.beginPath(); g.moveTo(x - 8, by - h); g.lineTo(x + w / 2, by - h - 38); g.lineTo(x + w + 8, by - h); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 8, by - h); g.lineTo(x + w / 2, by - h - 38); g.lineTo(x + w / 2, by - h - 28); g.lineTo(x + 2, by - h + 2); g.fill();
    g.beginPath(); g.moveTo(x + w + 8, by - h); g.lineTo(x + w / 2, by - h - 38); g.lineTo(x + w / 2, by - h - 28); g.lineTo(x + w - 2, by - h + 2); g.fill();
    g.fillStyle = '#6b3b2e'; g.fillRect(x + w * 0.75, by - h - 36, 12, 24);
    g.fillStyle = '#fff'; g.fillRect(x + w * 0.75 - 2, by - h - 40, 16, 6);
    g.fillStyle = '#ffd36b'; g.shadowColor = '#ffb703'; g.shadowBlur = 12;
    g.fillRect(x + 14, by - h + 16, 20, 20); g.fillRect(x + w - 34, by - h + 16, 20, 20);
    g.shadowBlur = 0;
    g.fillStyle = '#2a1f2d'; g.fillRect(x + w / 2 - 9, by - 30, 18, 30);
  };
  house(30, 110, 70, '#8c5a4a'); house(215, 100, 62, '#5a6f9a'); house(405, 120, 76, '#9a6a52');
  house(610, 100, 64, '#6b8a7a'); house(790, 112, 72, '#8a5a6e');
  // 松樹
  const tree = (x, y, s) => {
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i % 2 ? '#1f5b3a' : '#246b43';
      g.beginPath(); g.moveTo(x - (46 - i * 10) * s, y - i * 26 * s); g.lineTo(x, y - (i * 26 + 44) * s); g.lineTo(x + (46 - i * 10) * s, y - i * 26 * s); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - (18 - i * 3) * s, y - (i * 26 + 30) * s); g.lineTo(x, y - (i * 26 + 44) * s); g.lineTo(x + (18 - i * 3) * s, y - (i * 26 + 30) * s); g.fill();
    }
    g.fillStyle = '#4a2e1e'; g.fillRect(x - 5 * s, y, 10 * s, 12 * s);
  };
  [[170, 270, 1.0], [360, 272, 0.9], [575, 270, 1.0], [740, 272, 0.9], [930, 270, 1.0], [5, 272, 0.9]].forEach(a => tree(...a));
  // 雪地
  gr = g.createLinearGradient(0, 255, 0, H);
  gr.addColorStop(0, '#d5e4f7'); gr.addColorStop(0.35, '#e9f2fc'); gr.addColorStop(1, '#ffffff');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 262);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, 258 + Math.sin(x * 0.02) * 4);
  g.lineTo(W, H); g.lineTo(0, H); g.fill();
  g.fillStyle = 'rgba(120,150,200,.18)';
  for (let i = 0; i < 22; i++) { const x = rnd() * W, y = 290 + rnd() * 240; g.beginPath(); g.ellipse(x, y, 40 + rnd() * 60, 5 + rnd() * 6, 0, 0, TAU); g.fill(); }
  // 路燈圈
  g.fillStyle = 'rgba(255,230,160,.0)';
})();

const flakes = [];
for (let i = 0; i < 110; i++) flakes.push({ x: rand(0, W), y: rand(0, H), z: rand(0.4, 1.4), p: rand(0, 6) });

// ---------------- 輸入 ----------------
const BTN = {
  gift: { x: 14, y: 470, w: 122, h: 58 },
  coal: { x: 144, y: 470, w: 122, h: 58 },
  mute: { x: W - 58, y: H - 52, w: 44, h: 40 },
  home: { x: W - 108, y: H - 52, w: 44, h: 40 },
};
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function setItem(k) {
  if (santa.item === k) return;
  santa.item = k; Sfx.swap();
}
function toggleItem() { setItem(santa.item === 'gift' ? 'coal' : 'gift'); }

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  Sfx.init();
  const p = toGame(e); mouse.x = p.x; mouse.y = p.y;
  if (e.button === 2) { if (state === 'play') toggleItem(); return; }
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  onPress(p);
});
canvas.addEventListener('pointermove', e => { const p = toGame(e); mouse.x = p.x; mouse.y = p.y; });
const release = () => { mouse.down = false; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); if (state === 'play') toggleItem(); }, { passive: false });
window.addEventListener('keydown', e => {
  Sfx.init();
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') {
    e.preventDefault();
    if (state === 'title') return startIntro();
    if (state === 'intro') { if (introT > 0.4) startGame(); return; }
    if (state === 'over') { if (overT > 0.8) startGame(); return; }
    if (k === ' ' && state === 'play' && !e.repeat) toggleItem();
    return;
  }
  if (k === 'h') { goHome(); return; }
  if (state !== 'play') return;
  if (k === '1') setItem('gift');
  else if (k === '2') setItem('coal');
  else if (k === 'q' || k === 'e' || k === 'tab') { e.preventDefault(); toggleItem(); }
  else if (k === 'p' || k === 'escape') paused = !paused;
  else if (k === 'm') Sfx.toggleMute();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') paused = true; });

// 回入口頁。遊戲進行中且已有得分時先確認,避免誤觸丟掉進度
function goHome() {
  if (state === 'play' && G.score > 0 && !confirm('回到首頁?目前這局的進度不會保存。')) return;
  location.href = 'index.html';
}

function onPress(p) {
  if (inRect(p, BTN.home)) { goHome(); return; }
  if (inRect(p, BTN.mute)) { Sfx.toggleMute(); return; }
  if (state === 'title') return startIntro();
  if (state === 'intro') { if (introT > 0.4) startGame(); return; }
  if (state === 'over') { if (overT > 0.8) startGame(); return; }
  if (paused) { paused = false; return; }
  if (inRect(p, BTN.gift)) { setItem('gift'); return; }
  if (inRect(p, BTN.coal)) { setItem('coal'); return; }
  mouse.down = true;
  throwAt(p.x, p.y);
}

// 開場短動畫(約 3.3 秒,點擊/按鍵可跳過):穿著外套→爆衣→露出肌肉、露齒一笑
function startIntro() {
  resetGame();
  state = 'intro'; introT = 0; introFx = [false, false];
  Sfx.click();
}

function startGame() {
  resetGame();
  state = 'play'; paused = false;
  Sfx.click();
  say('Ho Ho Ho! 發禮物囉!');
}

// ---------------- 工具:特效 ----------------
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(0.3, 1) * (o.speed || 200);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up ? -(o.up) : 0), g: o.g == null ? 500 : o.g,
      life: rand(0.5, 1) * (o.life || 0.8), max: 0, size: rand(0.6, 1) * (o.size || 6),
      col: Array.isArray(o.col) ? pick(o.col) : o.col, shape: o.shape || 'dot', rot: rand(0, TAU), vr: rand(-10, 10),
    });
    particles[particles.length - 1].max = particles[particles.length - 1].life;
  }
}
function addText(x, y, txt, col, size, life) {
  texts.push({ x, y, txt, col: col || '#ffe066', size: size || 28, life: life || 1, max: life || 1, vy: -60 });
}
function say(txt, dur) { bubble = { txt, t: 0, life: dur || 1.4 }; }
function flash(col, v) { G.flash = Math.min(v, 0.3) * (col === '#ffffff' ? 0.6 : 1); G.flashCol = col; }   // 閃光不要太刺眼

const SAY_GIFT = ['Ho Ho Ho!', '給你的!', '乖孩子有糖吃!', '肌肉也是禮物!'];
const SAY_COAL = ['吃我煤炭!', '壞孩子!', '燒起來!', '今年別想了!'];
const SAY_WRONG = ['哎呀手滑...', '眼睛花了!?', '認錯人了!'];

// ---------------- 投擲 ----------------
const THROW_DUR = 0.26;

function ring(x, y, size, col) {
  particles.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.35, max: 0.35, size, col, shape: 'ring', rot: 0, vr: 0 });
}
function addPow(x, y, txt, bg, size) {
  texts.push({ x, y, txt, bg, size: size || 56, life: 0.55, max: 0.55, vy: 0, pow: true, rot: rand(-0.25, 0.25), col: '#fff' });
}
// 命中衝擊:衝擊環 + 放射速度線 + 漫畫擬聲字 + 頓幀 + 震動
function impact(x, y, kind, wrong) {
  const coal = kind === 'coal';
  ring(x, y, 34, coal ? '#ffb703' : '#ffffff');
  burst(x, y, 12, { col: coal ? ['#ffb703', '#ff7b00', '#fff'] : ['#fff', '#ffe066', '#ffb3de'], shape: 'line', size: 16, speed: 560, g: 0, life: 0.3 });
  // 擬聲字放在目標頭上偏一側,不要蓋住目標本身的受擊動作
  addPow(x + 26, y - 40, wrong ? 'OOPS!' : coal ? 'BAM!' : 'POP!', wrong ? '#6c757d' : coal ? '#ff7b00' : '#ff4d6d', 44);
}
let lastThrow = -9;

function santaShoulder() { return { x: santa.x + 72 * santa.s * santa.dir, y: santa.y - 176 * santa.s }; }
function santaAim() {
  const sh = santaShoulder();
  return Math.atan2(mouse.y - sh.y, (mouse.x - sh.x) * santa.dir);
}
function santaHand() {
  const a = santaAim();
  const ah = Art.santaHand(a, santa.s, santa.dir);   // 有正式圖:以圖上的手部錨點為出手位置
  if (ah) return { x: santa.x + ah.x, y: santa.y + ah.y };
  return { x: santa.x + (72 + 104 * Math.cos(a)) * santa.s * santa.dir, y: santa.y + (-176 + 104 * Math.sin(a)) * santa.s };
}

function throwAt(x, y) {
  if (state !== 'play' || paused) return;
  if (yeti && yeti.phase !== 'fight') return;
  if (muscle) return;   // 被肌肉擋住視線時不能投擲
  const cd = yeti ? 0.09 : 0.17;
  if (time - lastThrow < cd) return;
  lastThrow = time;
  santa.throwT = 0;
  const d = Math.hypot(x - santa.x, y - (santa.y - 180));
  projectiles.push({
    // 短促直線飛行(不走拋物線):出手瞬間就「砰」地射過去
    kind: santa.item, tx: x, ty: y, delay: THROW_DUR * 0.32, t: 0, dur: 0.05 + d / 9000,
    x0: 0, y0: 0, x: -999, y: -999, size: 1, rot: 0, spin: rand(-10, 10), started: false,
  });
  Sfx.throw();
}

// 先找精準命中;沒中的話再放寬一圈(瞄準輔助),手感比較寬容
function pickTarget(x, y) {
  for (const margin of [12, 34]) {
    let best = null, bd = 1e9;
    for (const t of targets) {
      if (!(t.state === 'idle' || (t.state === 'rise' && t.pop > 0.6))) continue;
      const cx = t.x, cy = t.y - 52 * t.s, rx = (t.kind === 'good' ? 32 : 38) * t.s + margin, ry = 64 * t.s + margin;
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d <= 1) { const sc = d - t.y * 0.0006; if (sc < bd) { bd = sc; best = t; } }
    }
    if (best) return best;
  }
  return null;
}

function land(p) {
  if (yeti) {
    if (yeti.phase === 'fight') hitYeti(p);
    else { burst(p.tx, p.ty, 6, { col: '#fff', size: 4, speed: 120 }); }
    return;
  }
  const tg = pickTarget(p.tx, p.ty);
  if (!tg) {
    burst(p.tx, p.ty, 8, { col: ['#fff', '#cfe3ff'], size: 5, speed: 140, up: 60 });
    Sfx.splash();
    return;
  }
  applyHit(tg, p);
}

// 打到偽裝的聖誕老人:不論丟什麼,全螢幕展示肌肉 1.2~1.8 秒(期間目標計時剩一半速度)
function triggerMuscle(tg) {
  tg.served = true; tg.state = 'leave'; tg.t = 0;
  const v = (Math.random() * MUSCLE_SHOWS.length) | 0;
  muscle = { t: 0, dur: rand(1.4, 2.0), seed: Math.random() * 10, v, dis: tg.dis || 1, line: pick(MUSCLE_LINES), news: pick(MUSCLE_NEWS) };
  burst(tg.x, tg.y - 60 * tg.s, 14, { col: ['#fff', '#ffd166', '#ff5ea8'], shape: 'star', size: 9, speed: 300, up: 100 });
  Sfx.slam(); Sfx.hoho();
  flash('#ffffff', 0.6);
}

function applyHit(tg, p) {
  if (tg.kind === 'santa') return triggerMuscle(tg);
  const ok = (tg.good && p.kind === 'gift') || (!tg.good && p.kind === 'coal');
  tg.served = true; tg.state = 'react'; tg.t = 0;
  tg.hitDir = (tg.x >= santa.x ? 1 : -1);   // 被打飛的方向(遠離聖誕老人)
  const cx = tg.x, cy = tg.y - 70 * tg.s;
  impact(cx, cy + 10, p.kind, !ok);
  if (ok) {
    G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.comboPop = 1; G.served++;
    G.fever = Math.min(yetiThreshold(), G.fever + 1);
    G.okStreak++;
    if (G.wrong > 0 && G.okStreak >= 10) { G.wrong--; G.okStreak = 0; addText(100, 96, '失誤冷卻 -1', '#9bf6a8', 18, 1.2); }
    const pts = Math.round(100 * getMult());
    G.score += pts;
    santa.flexKick = 1;
    addText(cx, cy - 84, '+' + pts, '#ffe066', 30);
    if (tg.good) {
      tg.mood = 'happy';
      burst(cx, cy, 16, { col: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#fff'], shape: 'confetti', size: 7, speed: 260, up: 160 });
      burst(cx, cy - 20, 4, { col: '#ff6b81', shape: 'heart', size: 12, speed: 80, up: 120, g: -60, life: 1.2 });
      Sfx.giftHit();
      if (Math.random() < 0.5) say(pick(SAY_GIFT));
    } else {
      tg.mood = 'coal';
      burst(cx, cy, 18, { col: ['#222', '#444', '#ff7b00', '#111'], size: 6, speed: 280, up: 120 });
      Sfx.coalHit();
      if (Math.random() < 0.5) say(pick(SAY_COAL));
    }
    if (G.combo % 5 === 0) {
      addText(480, 150, G.combo + ' COMBO!', '#ff5ea8', 44, 1.2);
      Sfx.combo(); Sfx.hoho();
      flash('#ffd166', 0.35);
      say(pick(['肌肉全開!', '看我的二頭肌!', 'FEVER!!']), 1.6);
    }
  } else {
    const lost = G.combo;
    breakCombo(); G.score = Math.max(0, G.score - 100);
    G.okStreak = 0; G.wrong++;
    if (G.wrong >= WRONG_LIMIT) {          // 連錯 3 次:除了扣分,還要扣一顆愛心
      G.wrong = 0;
      addText(480, 230, '連錯 3 次!扣一顆心', '#ff8a8a', 36, 1.8);
      loseHeart(true);
    }
    tg.mood = tg.good ? 'cry' : 'smug';
    addText(cx, cy - 62, '-100', '#ff4d4d', 30);
    if (tg.good) {
      addText(cx, cy - 92, '嗚哇~ 煤炭!?', '#9ad1ff', 22);
      burst(cx, cy, 12, { col: ['#222', '#444'], size: 6, speed: 200, up: 80 });
      Sfx.wrong(); Sfx.cry();
    } else {
      addText(cx, cy - 92, '哈哈哈 謝啦!', '#ff9aa2', 22);
      burst(cx, cy, 10, { col: ['#ff4d4d', '#ffd166'], shape: 'star', size: 8, speed: 200, up: 80 });
      Sfx.wrong(); Sfx.laugh();
    }
    if (lost >= 4) addText(480, 150, '連擊減半...', '#ff8a8a', 30, 1);
    say(pick(SAY_WRONG));
  }
}

// ---------------- 目標 ----------------
// 一局基準 1.5~2 分鐘:難度用「加速時間」dif() 推進(真實 1 秒 = 2.6 難度秒),約 2 分鐘進入極限,之後仍緩慢加壓,讓高手也會在 3~4 分鐘內結束。
const dif = () => G.elapsed * 2.6;
// 基礎目標頻率放緩;後期難度主要由「偽裝老人」製造(惡搞式的干擾,比單純變快不討厭)
const spawnInterval = () => Math.max(0.4, 1.2 - dif() * 0.0022);
const maxConcurrent = () => Math.min(6, 3 + Math.floor(dif() / 70));
const targetLife = () => Math.max(1.9, 4.4 - dif() * 0.0085);

function spawnTarget() {
  let free = spots.filter(s => !s.occ);
  if (!free.length) return;
  const sp = pick(free);
  // 偽裝成目標的聖誕老人(打到會被肌肉擋住畫面):約 21 秒後(難度秒 55)開始混進來,
  // 越晚越頻繁、冷卻越短、約 58 秒後可同時兩個;連擊高時機率再加成。
  // 約 38 秒前只有「好小孩」造型(教學),之後加入流氓、哥布林造型。
  const nSanta = targets.filter(t => t.kind === 'santa').length;
  if (dif() >= 55 && G.santaCd <= 0 && nSanta < (dif() >= 150 ? 2 : 1) &&
      Math.random() < Math.min(0.3, 0.07 + (dif() - 55) * 0.001) + Math.min(0.08, G.combo * 0.0015)) {
    G.santaCd = Math.max(2.5, 6 - (dif() - 55) * 0.017);
    const dis = dif() < 100 ? 1 : 1 + ((Math.random() * 3) | 0);
    targets.push({
      kind: 'santa', dis, good: dis === 1, spot: sp, x: sp.x, y: sp.y, s: sp.s, state: 'rise', pop: 0, t: 0,
      life: targetLife() * 1.2, lifeMax: targetLife() * 1.2, mood: 'idle', v: (Math.random() * 3) | 0, served: false,
    });
    sp.occ = true;
    if (!G.santaHint) { G.santaHint = true; say('那個小孩...看起來有點眼熟?', 2); }
    return;
  }
  // 避免連續三個同陣營:太多同款會無聊,完全隨機又可能一直在切換
  let wantGood = Math.random() < 0.5;
  if (spawnHist.length >= 2 && spawnHist[0] === spawnHist[1]) wantGood = !spawnHist[0];
  spawnHist.unshift(wantGood); spawnHist.length = Math.min(spawnHist.length, 2);
  const kind = wantGood ? 'good' : (Math.random() < 0.5 ? 'thug' : 'goblin');
  const lifeMax = targetLife() * rand(0.9, 1.15);
  targets.push({
    kind, good: kind === 'good', spot: sp, x: sp.x, y: sp.y, s: sp.s, state: 'rise', pop: 0, t: 0,
    life: lifeMax, lifeMax, mood: 'idle', v: (Math.random() * 3) | 0, served: false,
  });
  sp.occ = true;
}

// 扣愛心:受傷後有 0.9 秒保護期,避免同時間好幾個目標超時一次扣光
function loseHeart(forced) {
  if (G.grace > 0 && !forced) return false;
  if (state !== 'play') return false;    // 結算後不再扣愛心
  G.lives = Math.max(0, G.lives - 1); breakCombo(); G.hurt = 1; G.grace = 0.9;
  // 喘息:場上存活的目標多給 1 秒,避免一次崩盤連扣
  for (const t of targets) if (t.state === 'idle') { t.life += 1; t.lifeMax = Math.max(t.lifeMax, t.life); }
  flash('#ff2d2d', 0.5);
  Sfx.heart();
  if (G.lives <= 0) endGame();
  return true;
}

function endGame() {
  if (state === 'over') return;          // 只結算一次(同一幀內可能有多個事件都想結束遊戲)
  state = 'over'; overT = 0; mouse.down = false;
  projectiles.length = 0;                // 已飛出的投擲物不再落地,避免結算後分數又變動
  G.rank = Scores.add(G.score, G.maxCombo, G.elapsed);   // 寫入本機排行榜(前 5 名)
  best = Scores.best();
  Sfx.gameover();
}

function updateTargets(dt) {
  const frozen = !!yeti;
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    t.t += dt;
    if (t.state === 'rise') {
      t.pop = Math.min(1, t.pop + dt / 0.28);
      if (t.pop >= 1) { t.state = 'idle'; t.t = 0; }
    } else if (t.state === 'idle') {
      if (!frozen) t.life -= dt;
      if (t.life <= 0 && !frozen && t.kind === 'santa') {
        // 沒上當,偽裝老人自己溜走,不扣心
        t.state = 'leave'; t.t = 0; t.served = true;
        // 識破有獎勵:加分,聖誕老人還會碎碎念,讓「不打他」是正確又好玩的選擇
        G.score += 150;
        addText(t.x, t.y - 100 * t.s, '被你識破了! +150', '#fff8b0', 22);
        addText(t.x, t.y - 128 * t.s, pick(['嘖,被發現了…', '我的變裝完美的說!', '這都被你看穿!', '下次換個造型!']), '#ffffff', 20, 1.6);   // 是偽裝老人自己在碎碎念,不是主角
        burst(t.x, t.y - 50 * t.s, 10, { col: ['#fff', '#ffe066'], shape: 'star', size: 8, speed: 220, up: 80 });
      } else if (t.life <= 0 && !frozen) {
        // 沒處理就離開 → 扣一顆心
        addText(t.x, t.y - 100 * t.s, t.good ? '沒收到禮物...' : '壞蛋跑掉了!', '#ff8a8a', 22);
        t.mood = t.good ? 'cry' : 'smug';
        t.state = 'leave'; t.t = 0; t.missed = true;
        if (t.good) Sfx.cry(); else Sfx.laugh();
        loseHeart();
      }
    } else if (t.state === 'react') {
      if (t.t > (t.longReact ? 1.5 : 0.95)) { t.state = 'leave'; t.t = 0; }
    } else if (t.state === 'leave') {
      if (t.t > (t.missed ? 0.7 : 0.15)) t.pop -= dt / 0.3;
      if (t.pop <= 0) { t.spot.occ = false; targets.splice(i, 1); }
    }
  }
}

// ---------------- 雪怪 ----------------
function startYeti() {
  yeti = {
    phase: 'enter', t: 0, maxHp: 24 + 6 * Math.min(G.yetiCount, 6), hp: 0, timeLeft: 10,
    hit: 0, mood: 'roar', dmg: 0, dropY: -520, slammed: false, moodT: 0,
  };
  yeti.hp = yeti.maxHp;
  banner = { txt: '⚠ 雪怪來襲 ⚠', sub: '快換煤炭!狂點打倒牠!', t: 0, life: 1.8 };
  Sfx.yetiRoar();
  flash('#6ec6ff', 0.5);
  say('是雪怪!拿煤炭來!', 1.8);
}

function hitYeti(p) {
  const dx = (p.tx - 480) / 250, dy = (p.ty - (yeti.baseY - 230)) / 235;
  if (dx * dx + dy * dy > 1) { burst(p.tx, p.ty, 6, { col: '#fff', size: 4, speed: 120 }); Sfx.splash(); return; }
  if (p.kind === 'coal') {
    yeti.hp--; yeti.hit = 1; yeti.dmg = 1 - yeti.hp / yeti.maxHp;
    burst(p.tx, p.ty, 10, { col: ['#222', '#444', '#ff7b00'], size: 6, speed: 240, up: 100 });
    addText(p.tx + rand(-20, 20), p.ty - 20, '-1', '#fff', 22, 0.6);
    Sfx.yetiHit();
    ring(p.tx, p.ty, 30, '#ffb703');
    burst(p.tx, p.ty, 8, { col: ['#ffb703', '#fff'], shape: 'line', size: 16, speed: 520, g: 0, life: 0.25 });
    if (yeti.hp % 6 === 0) addPow(p.tx, p.ty - 10, 'BONK!', '#ff7b00', 50);
    G.score += 10;
    if (yeti.hp <= 0) defeatYeti();
  } else {
    yeti.hp = Math.min(yeti.maxHp, yeti.hp + 2); yeti.dmg = 1 - yeti.hp / yeti.maxHp;
    yeti.mood = 'eat'; yeti.moodT = 0.7;
    addText(p.tx, p.ty - 20, '雪怪吃掉了! 回血+2', '#7fd4ff', 22, 1);
    Sfx.burp();
  }
}

function defeatYeti() {
  yeti.phase = 'dying'; yeti.t = 0; yeti.mood = 'dizzy';
  Sfx.win(); flash('#ffffff', 0.7);
  let n = 0;
  for (const t of targets) {
    if (t.served || t.state === 'leave') continue;
    if (t.kind === 'santa') { t.served = true; t.state = 'leave'; t.t = 0; continue; }
    t.served = true; t.state = 'react'; t.t = -0.05 * n; t.longReact = true; n++;
    const wasBad = !t.good;
    t.good = true; t.mood = 'conv';
    G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.served++;
    const pts = Math.round(150 * getMult());
    G.score += pts;
    const cx = t.x, cy = t.y - 80 * t.s;
    addText(cx, cy - 20, '+' + pts, '#ffe066', 30);
    if (wasBad) addText(cx, cy - 56, '洗白成好孩子!', '#fff8b0', 20, 1.3);
    burst(cx, cy, 20, { col: ['#fff', '#ffe066', '#ffd1f0'], shape: 'star', size: 9, speed: 280, up: 140, life: 1 });
    burst(cx, cy - 10, 5, { col: '#ff6b81', shape: 'heart', size: 13, speed: 80, up: 120, g: -60, life: 1.3 });
  }
  const bonus = 500 + 100 * G.yetiCount;
  G.score += bonus; G.fever = 0;
  if (G.lives < 3) { G.lives++; addText(100, 70, '+1 ♥', '#ff6b81', 34, 1.6); }
  addText(480, 200, '雪怪擊倒! +' + bonus, '#fff', 40, 1.8);
  santa.victoryT = 3;
  say('全場都是好孩子!Ho Ho Ho!', 2.4);
}

function updateYeti(dt) {
  const y = yeti;
  y.t += dt; y.hit = Math.max(0, y.hit - dt * 5);
  if (y.moodT > 0) { y.moodT -= dt; if (y.moodT <= 0 && y.phase === 'fight') y.mood = 'idle'; }
  y.baseY = H - 20;
  if (y.phase === 'enter') {
    const k = clamp((y.t - 0.2) / 0.6, 0, 1);
    y.dropY = lerp(-560, 0, k * k);
    if (!y.slammed && k >= 1) { y.slammed = true; Sfx.slam(); burst(480, 500, 30, { col: ['#fff', '#cfe3ff'], size: 9, speed: 400, up: 100 }); }
    if (y.t > 1.3) {
      y.phase = 'fight'; y.mood = 'idle'; y.t = 0;
      if (santa.item !== 'coal') setItem('coal');
    }
  } else if (y.phase === 'fight') {
    y.timeLeft -= dt;
    if (mouse.down && time - lastThrow > 0.2) throwAt(mouse.x, mouse.y);
    if (y.timeLeft <= 0) {
      y.phase = 'fail'; y.t = 0; y.mood = 'roar';
      Sfx.yetiRoar();
    }
  } else if (y.phase === 'dying') {
    if (y.t > 2.0) { yeti = null; G.yetiCount++; G.yetiCd = 4; }
  } else if (y.phase === 'fail') {
    // 注意:slammed 已在登場砸地時用掉,失敗懲罰要用獨立旗標,否則永遠不會觸發
    if (y.t > 0.4 && !y.punished) {
      y.punished = true; Sfx.slam();
      addText(480, 200, '被雪怪踩扁了!', '#ff6b6b', 40, 1.5);
      addText(480, 250, '連擊歸零  能量清空  -500', '#ffb3b3', 26, 1.6);
      G.score = Math.max(0, G.score - 500);
      loseHeart(true);
      G.combo = 0; G.fever = 0;   // 進度打回原點(雪怪不算擊倒,下次門檻不變)
    }
    if (y.t > 1.6) { yeti = null; G.yetiCd = 5; }
  }
}

// ---------------- 分身 ----------------
function syncClones() {
  const want = Math.min(CLONE_SLOTS.length, Math.floor(G.combo / 5));
  const active = clones.filter(c => !c.leaving);
  if (active.length < want) {
    for (let slot = 0; slot < CLONE_SLOTS.length && clones.filter(c => !c.leaving).length < want; slot++) {
      if (clones.some(c => c.slot === slot)) continue;
      clones.push({ slot, pop: 0, leaving: false, pose: CLONE_POSES[slot % 4], pal: SANTA_PALS[(slot + 1) % SANTA_PALS.length], t: rand(0, 6) });
      const [sx, sy, ss] = CLONE_SLOTS[slot];
      burst(sx, sy - 100 * ss, 14, { col: ['#fff', '#ffd166', '#ff5ea8'], shape: 'star', size: 8, speed: 260, up: 80 });
      addText(sx, sy - 220 * ss, 'Santa 分身!', '#ffd166', 20, 1);
    }
  } else if (active.length > want) {
    active.sort((a, b) => b.slot - a.slot);
    for (let i = 0; i < active.length - want; i++) {
      active[i].leaving = true;
      const [sx, sy, ss] = CLONE_SLOTS[active[i].slot];
      burst(sx, sy - 100 * ss, 10, { col: ['#bbb', '#fff'], size: 9, speed: 180 });
    }
  }
}
function updateClones(dt) {
  for (let i = clones.length - 1; i >= 0; i--) {
    const c = clones[i]; c.t += dt;
    if (c.leaving) { c.pop -= dt * 3; if (c.pop <= 0) clones.splice(i, 1); }
    else c.pop = Math.min(1, c.pop + dt * 3);
  }
}

// ---------------- 主更新 ----------------
function update(dt) {
  time += dt;
  for (const f of flakes) {
    f.y += (30 + 40 * f.z) * dt; f.x += Math.sin(time * 0.8 + f.p) * 14 * dt;
    if (f.y > H + 6) { f.y = -6; f.x = rand(0, W); }
  }
  santa.t += dt;
  santa.flexKick = Math.max(0, santa.flexKick - dt * 3);
  if (santa.victoryT > 0) santa.victoryT -= dt;
  if (Math.abs(mouse.x - santa.x) > 40) santa.dir = mouse.x > santa.x ? 1 : -1;
  if (santa.throwT >= 0) { santa.throwT += dt / THROW_DUR; if (santa.throwT >= 1) santa.throwT = -1; }

  for (const p of particles) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  for (const t of texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.96; }
  for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
  G.flash = Math.max(0, G.flash - dt * 1.8);
  G.hurt = Math.max(0, G.hurt - dt * 1.5);
  G.comboPop = Math.max(0, G.comboPop - dt * 4);
  if (bubble) { bubble.t += dt; if (bubble.t > bubble.life) bubble = null; }
  if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; }

  if (state === 'title') { santa.pose = 'flex'; return; }
  if (state === 'intro') {
    introT += dt;
    if (introT >= 1.15 && !introFx[0]) { introFx[0] = true; Sfx.rip(); }
    if (introT >= 1.8 && !introFx[1]) { introFx[1] = true; Sfx.win(); Sfx.hoho(); }
    if (introT >= INTRO_END) startGame();
    return;
  }
  if (state === 'over') { overT += dt; santa.pose = 'pump'; updateClones(dt); updateTargets(dt); return; }
  if (paused) return;

  // ---- play ----
  G.elapsed += dt;
  santa.pose = santa.victoryT > 0 ? 'pump' : 'throw';
  if (G.yetiCd > 0) G.yetiCd -= dt;
  if (G.grace > 0) G.grace -= dt;
  if (G.santaCd > 0) G.santaCd -= dt;

  if (muscle) { muscle.t += dt; if (muscle.t >= muscle.dur) muscle = null; }

  if (!yeti) {
    if (!muscle) G.spawnT -= dt;
    if (!muscle && G.spawnT <= 0 && targets.filter(t => t.state !== 'leave').length < maxConcurrent()) {
      spawnTarget(); G.spawnT = spawnInterval() * rand(0.8, 1.25);
    }
    if (G.yetiCd <= 0 && G.fever >= yetiThreshold() && state === 'play' && !muscle) startYeti();
  } else updateYeti(dt);

  updateTargets(muscle ? dt * 0.5 : dt);
  if (state !== 'play') return;          // 這一幀已經結算,後面的更新(分身、投擲物落地)都不用做了
  syncClones(); updateClones(dt);

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p) continue;                    // 落地時若觸發結算,陣列會被清空
    if (p.delay > 0) {
      p.delay -= dt;
      if (p.delay <= 0) {
        const h = santaHand(); p.x0 = h.x; p.y0 = h.y; p.x = h.x; p.y = h.y; p.started = true;
        // 出手瞬間:手部衝擊環、往目標方向的速度線、腳邊揚雪、小震動
        const ang = Math.atan2(p.ty - h.y, p.tx - h.x);
        ring(h.x, h.y, 16, '#ffffff');
        for (let i = 0; i < 7; i++) {
          const a = ang + rand(-0.5, 0.5), sp = rand(500, 900);
          particles.push({ x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0.16, max: 0.16, size: rand(10, 18), col: '#fff', shape: 'line', rot: 0, vr: 0 });
        }
        burst(santa.x - santa.dir * 50, santa.y - 6, 7, { col: '#fff', size: 9, speed: 170, up: 70, life: 0.5 });
      }
      continue;
    }
    p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    p.x = lerp(p.x0, p.tx, k);
    p.y = lerp(p.y0, p.ty, k);
    p.size = lerp(1.15, clamp(0.45 + 0.55 * (p.ty / H), 0.4, 1), k);
    p.rot += p.spin * dt;
    if (k >= 1) { land(p); projectiles.splice(i, 1); }
  }
  if (mouse.down && !yeti) { /* 非雪怪期間不連發,避免亂丟 */ }
}

// ---------------- 繪製 ----------------
function outlineText(txt, x, y, size, fill, stroke, align) {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, size / 5);
  ctx.strokeStyle = stroke || '#1a1030'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill || '#fff'; ctx.fillText(txt, x, y);
}
function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.9, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.9, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.closePath();
}

// 受擊閃白:先畫到小畫布再用 source-atop 染白,最後貼回主畫面
// (不用 ctx.filter,因為它會讓每一筆繪圖指令都跑一次濾鏡,角色筆畫多時很容易卡)
const flashCv = document.createElement('canvas');
flashCv.width = 360; flashCv.height = 330;
const flashCtx = flashCv.getContext('2d');
function drawFlash(drawFn) {
  flashCtx.setTransform(1, 0, 0, 1, 0, 0);
  flashCtx.clearRect(0, 0, 360, 330);
  flashCtx.translate(180, 300);
  drawFn(flashCtx);
  flashCtx.setTransform(1, 0, 0, 1, 0, 0);
  flashCtx.globalCompositeOperation = 'source-atop';
  flashCtx.fillStyle = 'rgba(255,255,255,.85)';
  flashCtx.fillRect(0, 0, 360, 330);
  flashCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(flashCv, -180, -300);
}

function drawTarget(t) {
  const s = t.s;
  ctx.save();
  ctx.translate(t.x, t.y);
  // 光暈
  if (t.state !== 'leave' || t.pop > 0.5) {
    const good = t.good;
    const gr = ctx.createRadialGradient(0, -56 * s, 4, 0, -56 * s, 74 * s);
    const a = 0.2 + 0.1 * Math.sin(time * 6);
    gr.addColorStop(0, good ? `rgba(255,224,102,${a + 0.12})` : `rgba(255,40,40,${a + 0.1})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = t.pop; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, -56 * s, 76 * s, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // 受擊反應:被打飛(遠離聖誕老人)+ 壓扁彈回 + 瞬間閃白
  let kx = 0, sqx = 1, sqy = 1, flashing = false;
  if (t.hitDir && t.state === 'react') {
    const e = Math.max(0, 1 - t.t / 0.32), imp = Math.max(0, 1 - t.t / 0.18);
    kx = t.hitDir * 38 * e * e * s;
    sqx = 1 + 0.32 * imp * Math.cos(t.t * 40); sqy = 1 - 0.26 * imp * Math.cos(t.t * 40);
    flashing = t.t < 0.07;
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(-160 * s, -240 * s, 320 * s, 240 * s + 7 * s); ctx.clip();
  ctx.translate(kx, (1 - easeOutBack(t.pop)) * 130 * s);
  ctx.scale(s * sqx, s * sqy);
  if (t.kind === 'santa') {
    // 偽裝成小孩的聖誕老人:戴著毛帽,但墨鏡、大鬍子、肌肉藏不住
    const tt = Math.max(0, t.t) + t.v;
    drawSanta(ctx, { x: 0, y: 0, s: 0.36, dir: 1, t: tt, pose: Math.sin(tt * 0.9) > 0 ? 'flex' : 'pump', pal: SANTA_PALS[0], bf: 1.35 + 0.2 * Math.sin(tt * 8), disguise: t.dis || 1, dv: t.v });
  } else {
    const kd = { kind: t.kind, mood: t.mood === 'idle' && t.state === 'rise' ? 'idle' : t.mood, t: Math.max(0, t.t) + t.v, v: t.v };
    if (flashing) drawFlash(c => drawKid(c, kd)); else drawKid(ctx, kd);
  }
  ctx.restore();
  // 雪堆
  if (Art.icon(ctx, 'scene/snow_mound', 0, 9 * s, 92 * s)) { /* 正式圖 */ } else {
  ctx.fillStyle = '#eaf3ff'; ctx.beginPath(); ctx.ellipse(0, 2 * s, 48 * s, 13 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-6 * s, -1 * s, 38 * s, 9 * s, 0, 0, TAU); ctx.fill(); }
  // 剩餘時間
  if (t.state === 'idle' && !yeti) {
    const k = clamp(t.life / t.lifeMax, 0, 1), bw = 46 * s;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-bw / 2 - 1, -134 * s - 1, bw + 2, 7);
    ctx.fillStyle = k > 0.5 ? '#6bdc6b' : k > 0.25 ? '#ffd166' : '#ff4d4d';
    ctx.fillRect(-bw / 2, -134 * s, bw * k, 5);
  }
  ctx.restore();
}

function drawFigures() {
  const list = [];
  for (const c of clones) {
    const [x, y, s] = CLONE_SLOTS[c.slot];
    list.push({ y, f: () => {
      const sc = s * easeOutBack(c.pop);
      if (sc <= 0.01) return;
      drawSanta(ctx, { x, y, s: sc, dir: x < 480 ? 1 : -1, t: c.t, pose: c.pose, pal: c.pal, bf: 1.25 + 0.15 * Math.sin(c.t * 8), glint: true });
    } });
  }
  list.push({ y: santa.y + 1, f: () => {
    const holding = santa.pose === 'throw' ? santa.item : null;
    drawSanta(ctx, {
      x: santa.x, y: santa.y, s: santa.s, dir: santa.dir, t: santa.t, pose: santa.pose,
      aim: santaAim(), throwT: santa.throwT, item: holding, sack: true,
      bf: 1 + Math.min(0.5, G.combo * 0.015) + santa.flexKick * 0.35 + (santa.throwT > 0.2 && santa.throwT < 0.7 ? 0.45 : 0), glint: G.combo >= 10,
    });
  } });
  list.sort((a, b) => a.y - b.y).forEach(i => i.f());
}

function drawHUD() {
  // 愛心
  for (let i = 0; i < 3; i++) {
    const x = 36 + i * 40, y = 34, alive = i < G.lives;
    ctx.save();
    const pulse = alive && G.lives === 1 ? 1 + 0.12 * Math.sin(time * 10) : 1;
    ctx.translate(x, y); ctx.scale(pulse, pulse); ctx.translate(-x, -y);
    if (Art.icon(ctx, alive ? 'ui/heart_full' : 'ui/heart_empty', x, y, 40)) { ctx.restore(); continue; }
    heartPath(x, y, 28);
    ctx.fillStyle = alive ? '#ff3b5c' : 'rgba(255,255,255,.18)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#4a0f1c'; ctx.stroke();
    if (alive) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - 8, y - 8, 4, 3, -0.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // 失誤計數(連錯 3 次扣一顆心):三顆小點,點亮代表目前累積的失誤
  outlineText('失誤', 20, 66, 14, '#ffd6d6', '#1a1030', 'left');
  for (let i = 0; i < WRONG_LIMIT; i++) {
    ctx.beginPath(); ctx.arc(66 + i * 18, 66, 6, 0, TAU);
    ctx.fillStyle = i < G.wrong ? '#ff4d4d' : 'rgba(255,255,255,.2)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#1a1030'; ctx.stroke();
  }
  // 分數
  outlineText(String(G.score).padStart(6, '0'), W - 20, 34, 40, '#fff', '#1a1030', 'right');
  outlineText('最高 ' + best, W - 20, 66, 18, '#ffe9a8', '#1a1030', 'right');

  // 連擊 + 雪怪警報條
  const th = yetiThreshold();
  if (!yeti && !muscle) {
    const bw = 300, bx = W / 2 - bw / 2, by = 16;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; rr(ctx, bx - 3, by - 3, bw + 6, 20, 10); ctx.fill();
    const k = clamp(G.fever / th, 0, 1);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#4cc9f0'); g.addColorStop(1, '#f72585');
    ctx.fillStyle = g; if (k > 0) { rr(ctx, bx, by, Math.max(14, bw * k), 14, 7); ctx.fill(); }
    const hot = k >= 0.75;
    outlineText(hot ? '雪怪快來了!!' : '雪怪警報', W / 2, by + 7, 13, hot ? '#fff' : '#cfe8ff', '#10204a');
    if (G.combo >= 2 && !muscle) {
      const sc = 1 + G.comboPop * 0.35;
      ctx.save(); ctx.translate(W / 2, 62); ctx.scale(sc, sc);
      outlineText('COMBO ' + G.combo, 0, 0, 30, '#ffd166', '#5a1a00');
      ctx.restore();
      outlineText('× ' + getMult().toFixed(1), W / 2, 90, 18, '#fff', '#5a1a00');
    }
  } else if (yeti && yeti.phase === 'fight') {
    const bw = 420, bx = W / 2 - bw / 2, by = 16;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, bx - 4, by - 4, bw + 8, 26, 13); ctx.fill();
    ctx.fillStyle = '#e63946'; rr(ctx, bx, by, Math.max(10, bw * yeti.hp / yeti.maxHp), 18, 9); ctx.fill();
    outlineText('雪怪 ' + yeti.hp + ' / ' + yeti.maxHp, W / 2, by + 9, 15, '#fff', '#3a0a10');
    const tk = clamp(yeti.timeLeft / 10, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, bx, by + 30, bw, 10, 5); ctx.fill();
    ctx.fillStyle = tk > 0.3 ? '#ffd166' : '#ff4d4d'; rr(ctx, bx, by + 30, Math.max(8, bw * tk), 10, 5); ctx.fill();
    const blink = santa.item !== 'coal' || Math.sin(time * 14) > 0;
    if (blink) outlineText('狂點煤炭!!', W / 2, 92, 30, '#fff', '#b00020');
  }

  // 物品按鈕
  for (const k of ['gift', 'coal']) {
    const b = BTN[k], sel = santa.item === k;
    ctx.save();
    if (sel) { ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 18; }
    ctx.fillStyle = sel ? (k === 'gift' ? '#d62839' : '#3a3a48') : 'rgba(20,20,40,.7)';
    rr(ctx, b.x, b.y - (sel ? 6 : 0), b.w, b.h, 14); ctx.fill();
    ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#ffe066' : 'rgba(255,255,255,.35)'; ctx.stroke();
    ctx.restore();
    drawItem(ctx, k, b.x + 32, b.y + b.h / 2 - (sel ? 6 : 0), 1.1, 0);
    outlineText(k === 'gift' ? '禮物' : '煤炭', b.x + 80, b.y + b.h / 2 - 8 - (sel ? 6 : 0), 22);
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.textAlign = 'center';
    ctx.fillText('[' + (k === 'gift' ? '1' : '2') + ']', b.x + 80, b.y + b.h / 2 + 14 - (sel ? 6 : 0));
  }
  drawToggles();
}

function drawToggles() {
  for (const [b, on, label] of [[BTN.mute, !Sfx.muted, Sfx.muted ? '靜音' : '音效'], [BTN.home, true, '首頁']]) {
    ctx.fillStyle = 'rgba(20,20,40,.7)'; rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
    outlineText(label, b.x + b.w / 2, b.y + b.h / 2, 14, on ? '#fff' : '#888');
  }
}

function drawBubble() {
  if (!bubble) return;
  const k = smooth(Math.min(1, bubble.t / 0.15)) * (1 - smooth((bubble.t - (bubble.life - 0.25)) / 0.25));
  const x = clamp(santa.x + 40, 150, 800), y = santa.y - 330 * santa.s - 20;
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(Math.sin(time * 6) * 0.02);
  ctx.font = `900 24px ${FONT}`;
  const w = ctx.measureText(bubble.txt).width + 36;
  ctx.fillStyle = '#fff'; rr(ctx, -w / 2, -26, w, 46, 18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, 18); ctx.lineTo(-18, 34); ctx.lineTo(8, 18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#1a1030'; rr(ctx, -w / 2, -26, w, 46, 18); ctx.stroke();
  ctx.fillStyle = '#1a1030'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bubble.txt, 0, -2);
  ctx.restore();
}

// 全螢幕肌肉秀:背景完全蓋住場景,HUD(愛心/分數)仍然看得到。
// 隨機三種惡搞版本,避免每次都一樣而變得惹人厭。畫面上不放任何文字。
const MUSCLE_SHOWS = [0, 1, 2];
const MUSCLE_LINES = ['被你發現了!', '我只是來健身的!', '這是肌肉,不是小孩!', '變裝失敗~', '低調!低調!', '拍我可以,不要打我', '你有看到我的腹肌嗎?', '今天不練腿', '我是來送禮物的…', '點我幹嘛啦~'];
const MUSCLE_NEWS = [
  '【快訊】疑似聖誕老人偽裝成小孩,當場被識破 ◆ 目擊者:他的肌肉比孩子的身高還大 ◆ ',
  '【現場直擊】肌肉的重量大於禮物 ◆ 專家:這不是小孩,這是蛋白質 ◆ ',
  '【氣象】今晚有雪,也有胸肌 ◆ 駝背的煙囪表示壓力很大 ◆ ',
  '【獨家】聖誕老人坦承:煤炭是他的蛋白粉 ◆ 馴鹿工會要求加薪 ◆ ',
  '【體育】年度最佳偽裝獎揭曉:落選 ◆ 評審:鬍子太明顯 ◆ ',
];
// 畫出被打到的偽裝老人「脫落的偽裝」(毛帽/頭巾加假莫霍克/破帽加假尖耳),飛向兩側
function drawDisguisePiece(dis, side, p) {
  const x = W / 2 + side * (70 + 430 * p), y = 140 - 150 * p + 560 * p * p;
  ctx.save(); ctx.translate(x, y); ctx.rotate(side * p * 9); ctx.scale(1.5, 1.5);
  ctx.lineWidth = 3; ctx.strokeStyle = '#1a1030'; ctx.lineJoin = 'round';
  if (dis === 1) {            // 小孩毛帽
    ctx.fillStyle = '#3a86ff'; ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; rr(ctx, -28, -4, 56, 12, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, -30, 8, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (dis === 2) {     // 紅頭巾 + 假莫霍克
    ctx.fillStyle = '#ff2d2d';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 6, 0); ctx.lineTo(i * 9, -30 + Math.abs(i) * 5); ctx.lineTo(i * 9 + 6, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#d00000'; rr(ctx, -28, -2, 56, 14, 5); ctx.fill(); ctx.stroke();
  } else {                    // 破布帽 + 假的綠尖耳
    ctx.fillStyle = '#8b5e34'; ctx.beginPath(); ctx.arc(0, 0, 24, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7bc043';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 22, 0); ctx.lineTo(sd * 52, -18); ctx.lineTo(sd * 22, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}
// 全螢幕肌肉秀的惡搞配件:新聞直播台風格(LIVE、跑馬燈快訊)、主角自己吐槽的對話框、狗仔閃光燈
function drawMuscleExtras(m, a) {
  // 脫落的偽裝
  const pp = clamp(m.t / 1.3, 0, 1);
  if (pp < 1) { drawDisguisePiece(m.dis, -1, pp); drawDisguisePiece(m.dis, 1, pp); }
  // 對話框(偽裝老人自己講話)
  const bx = 640, by = 96, bw = 280, bh = 62, pop = smooth(m.t / 0.18);
  ctx.save(); ctx.translate(bx, by); ctx.scale(pop, pop);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 4;
  rr(ctx, -bw / 2, -bh / 2, bw, bh, 22); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-60, bh / 2 - 2); ctx.lineTo(-96, bh / 2 + 34); ctx.lineTo(-30, bh / 2 - 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#1a1030'; ctx.font = `900 ${m.line.length > 9 ? 22 : 28}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(m.line, 0, 1); ctx.restore();
  // LIVE 標籤
  ctx.fillStyle = '#e0162b'; rr(ctx, 150, 22, 82, 28, 6); ctx.fill();
  ctx.fillStyle = Math.sin(m.t * 14) > 0 ? '#fff' : '#ffb3b3'; ctx.beginPath(); ctx.arc(166, 36, 6, 0, TAU); ctx.fill();
  outlineText('LIVE', 204, 37, 16, '#fff', '#7a0010');
  // 下方跑馬燈快訊(避開左下按鈕與右下的音效/首頁按鈕)
  const tx = 282, tw = W - 120 - tx, ty = H - 40;
  ctx.fillStyle = 'rgba(15,10,40,.88)'; rr(ctx, tx, ty, tw, 28, 6); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(tx + 4, ty, tw - 8, 28); ctx.clip();
  ctx.font = `800 17px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const unit = ctx.measureText(m.news).width, off = (m.t * 150) % unit;
  for (let k = 0; k < 4; k++) ctx.fillText(m.news, tx + 8 - off + k * unit, ty + 15);
  ctx.restore();
  // 狗仔閃光燈:小範圍星芒隨機閃一下(不是全螢幕閃光)
  for (let i = 0; i < 6; i++) {
    const ph = (m.t * 5 + i * 0.37 + m.seed) % 1;
    if (ph > 0.14) continue;
    const fx = 90 + ((i * 331 + m.seed * 57) % 780), fy = 120 + ((i * 197 + m.seed * 31) % 260);
    ctx.fillStyle = `rgba(255,255,255,${1 - ph / 0.14})`; starPath(ctx, fx, fy, 30 - ph * 120, 4, 0.2); ctx.fill();
  }
}
   // 三種版本:放射光芒 / 迪斯可 / 愛心雨(不含任何文字)
function drawMuscleBG(m) {
  m.full = Art.cover(ctx, 'muscle/' + ['show_burst', 'show_disco', 'show_love'][m.v], W, H);   // 有滿版正式圖就直接用
  if (m.full) return;
  if (m.v === 1) {
    // 迪斯可地板:整面彩色方格
    for (let gx = 0; gx < W; gx += 80) for (let gy = 0; gy < H; gy += 80) {
      const hue = (m.t * 140 + gx * 0.35 + gy * 0.6) % 360;
      ctx.fillStyle = `hsl(${hue},85%,${50 + 14 * Math.sin(m.t * 10 + gx * 0.02 + gy * 0.03)}%)`;
      ctx.fillRect(gx, gy, 81, 81);
    }
  } else if (m.v === 2) {
    // 粉紅愛心雨
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ff7aa8'); g.addColorStop(1, '#ffd6e4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ba = ctx.globalAlpha;
    for (let i = 0; i < 16; i++) {
      const x = (i * 211 + m.seed * 97) % W, sz = 26 + (i * 17) % 40;
      const y = H + 40 - ((m.t * (110 + (i % 4) * 30) + i * 61) % (H + 100));
      ctx.fillStyle = i % 2 ? '#ff3d71' : '#ffffff'; ctx.globalAlpha = ba * 0.9;
      heartPath(x, y, sz); ctx.fill();
    }
    ctx.globalAlpha = ba;
  } else {
    // 放射光芒
    ctx.fillStyle = '#ffb703'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(m.t * 0.8);
    const n = 20;
    for (let i = 0; i < n; i += 2) {
      ctx.fillStyle = i % 4 === 0 ? '#ff3b5c' : '#ff7a3d';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(i * TAU / n) * 1200, Math.sin(i * TAU / n) * 1200);
      ctx.lineTo(Math.cos((i + 1) * TAU / n) * 1200, Math.sin((i + 1) * TAU / n) * 1200);
      ctx.fill();
    }
    ctx.restore();
  }
}
function drawMuscle() {
  const m = muscle, a = Math.min(smooth(m.t / 0.1), smooth((m.dur - m.t) / 0.18));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  drawMuscleBG(m);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a;
  if (!m.full) {   // 有滿版正式圖時,圖裡已經有聖誕老人,不再疊程式繪製版
  // 巨大聖誕老人
  const pulse = 1 + 0.03 * Math.sin(m.t * 14);
  const flexing = Math.floor(m.t * 3 + m.seed) % 2 === 0;
  const pose = m.v === 1 ? 'dance' : m.v === 2 ? 'pump' : (flexing ? 'flex' : 'pump');
  drawSanta(ctx, {
    x: W / 2, y: H + 70, s: (1.25 + 0.5 * a) * pulse, dir: 1, t: m.t * 1.6,
    pose, pal: SANTA_PALS[0], bf: 1.7 + 0.25 * Math.sin(m.t * 16), glint: true,
  });
  // 兩側小分身一起跳
  drawSanta(ctx, { x: 130, y: H + 20, s: 0.7, dir: 1, t: m.t * 1.6, pose: 'dance', pal: SANTA_PALS[4], bf: 1.4, glint: true });
  drawSanta(ctx, { x: W - 130, y: H + 20, s: 0.7, dir: -1, t: m.t * 1.6 + 1, pose: 'disco', pal: SANTA_PALS[2], bf: 1.4, glint: true });
  }
  drawMuscleExtras(m, a);
  ctx.restore();
}

function drawOverlays() {
  if (G.flash > 0.01) { ctx.globalAlpha = Math.min(1, G.flash); ctx.fillStyle = G.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (G.hurt > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${0.6 * G.hurt})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (banner) {
    const k = smooth(banner.t / 0.2) * (1 - smooth((banner.t - (banner.life - 0.3)) / 0.3));
    ctx.save(); ctx.translate(W / 2, 220); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(180,0,30,.75)'; ctx.fillRect(-W / 2, -48, W, 96);
    outlineText(banner.txt, 0, -10, 52, '#fff', '#5a0010');
    outlineText(banner.sub, 0, 30, 22, '#ffe9a8', '#5a0010');
    ctx.restore();
  }
}

function drawTitle() {
  ctx.fillStyle = 'rgba(5,8,25,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, 130); ctx.rotate(Math.sin(time * 2) * 0.02);
  outlineText('煤炭 or 禮物', 0, 0, 92, '#ffe066', '#7a1020');
  ctx.restore();
  drawItem(ctx, 'gift', 150, 130 + Math.sin(time * 3) * 6, 2.2, -0.3);
  drawItem(ctx, 'coal', 810, 130 + Math.cos(time * 3) * 6, 2.2, 0.3);
  outlineText('COAL  or  GIFT', W / 2, 200, 28, '#bfe3ff', '#10204a');
  const lines = [
    ['乖孩子 → 送禮物', '#9bf6a8'],
    ['壞孩子 → 砸煤炭', '#ff9aa2'],
    ['連擊越高分身越多,還會引來雪怪!', '#ffe9a8'],
    ['小心!聖誕老人會偽裝成小孩、流氓、哥布林 —— 別打他!', '#ffb3de'],
  ];
  lines.forEach((l, i) => outlineText(l[0], W / 2, 262 + i * 36, 26, l[1], '#10204a'));
  ctx.font = `700 16px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.textAlign = 'center';
  ctx.fillText('點擊畫面投擲 ／ [1][2]、空白鍵、滑鼠右鍵或下方按鈕切換物品', W / 2, 410);
  const a = 0.6 + 0.4 * Math.sin(time * 5);
  ctx.globalAlpha = a; outlineText('— 點擊開始 —', W / 2, 460, 40, '#fff', '#10204a'); ctx.globalAlpha = 1;
}

// ---------------- 開場動畫 ----------------
// 3 個階段(每段都可由 assets/intro/intro_1~3 的滿版圖取代,沒有圖就用下面的程式繪製):
//   1) 穿著外套、雙臂交叉用力抓緊胸前(發抖蓄力)   2) 爆衣!外套向兩側炸開飛走   3) 光著上身秀肌肉、露齒一笑
function coatHalf(side, p) {
  const e = 1 - Math.pow(1 - p, 3);
  ctx.save();
  ctx.translate(480 + side * (110 + 330 * e), 280 - 120 * e + 420 * p * p);
  ctx.rotate(side * (0.25 + p * 4.2)); ctx.scale(1.7, 1.7);
  ctx.fillStyle = '#d62828';
  ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(side * 74, -108); ctx.lineTo(side * 86, 12); ctx.lineTo(side * 24, 78); ctx.lineTo(0, 56); ctx.lineTo(-side * 8, -34); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a31d1d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(side * 30, -90); ctx.lineTo(side * 40, 20); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(-side * 8, -34); ctx.lineTo(0, 56); ctx.stroke();
  ctx.restore();
}
function introRays(c1, c2, spin, cy) {
  ctx.save(); ctx.translate(W / 2, cy); ctx.rotate(spin);
  for (let i = 0; i < 24; i += 2) {
    ctx.fillStyle = i % 4 === 0 ? c1 : c2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(i * TAU / 24) * 1400, Math.sin(i * TAU / 24) * 1400);
    ctx.lineTo(Math.cos((i + 1) * TAU / 24) * 1400, Math.sin((i + 1) * TAU / 24) * 1400); ctx.fill();
  }
  ctx.restore();
}
function introScene(st, lt) {
  if (st === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0b2e'); g.addColorStop(1, '#5a1f3d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,240,200,.16)'; ctx.beginPath(); ctx.moveTo(W / 2 - 40, 0); ctx.lineTo(W / 2 + 40, 0); ctx.lineTo(W / 2 + 330, H); ctx.lineTo(W / 2 - 330, H); ctx.fill();
    drawSanta(ctx, { x: W / 2, y: H + 130, s: 1.75, dir: 1, t: lt, pose: 'cross', pal: SANTA_PALS[0], clothed: true, bf: 1.35 });
  } else if (st === 1) {
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(0, 0, W, H);
    introRays('#ff3b5c', '#ffb703', lt * 1.5, H * 0.55);
    drawSanta(ctx, { x: W / 2, y: H + 140, s: 1.85, dir: 1, t: lt, pose: 'tear', pal: SANTA_PALS[0], bf: 1.7, glint: true });
    const p = clamp(lt / 0.6, 0, 1);
    coatHalf(-1, p); coatHalf(1, p);
    for (let i = 0; i < 16; i++) {   // 碎布片
      const a = i * 0.93 + 0.4, sp = 260 + (i % 5) * 90, e = 1 - Math.pow(1 - p, 2);
      ctx.save(); ctx.translate(480 + Math.cos(a) * sp * e * 1.3, 280 + Math.sin(a) * sp * e * 0.9 + 300 * p * p); ctx.rotate(a + p * 9);
      ctx.fillStyle = i % 3 ? '#d62828' : '#fff'; ctx.fillRect(-9, -5, 18 + (i % 4) * 4, 10); ctx.restore();
    }
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - p)})`;
    for (let i = 0; i < 26; i++) {   // 速度線
      const a = i * TAU / 26, a2 = a + 0.05;
      ctx.beginPath(); ctx.moveTo(480 + Math.cos(a) * 160, 290 + Math.sin(a) * 160);
      ctx.lineTo(480 + Math.cos(a) * 900, 290 + Math.sin(a) * 900); ctx.lineTo(480 + Math.cos(a2) * 900, 290 + Math.sin(a2) * 900); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#ffb703'; ctx.fillRect(0, 0, W, H);
    introRays('#ffd166', '#ff9f1c', lt * 0.5, H * 0.55);
    drawSanta(ctx, { x: W / 2, y: H + 140, s: 1.85, dir: 1, t: lt, pose: 'flex', pal: SANTA_PALS[0], bf: 1.75, glint: true });
    for (let i = 0; i < 14; i++) {   // 閃閃發光
      const a = i * 2.4, r = 250 + (i % 4) * 70, x = 480 + Math.cos(a) * r * 1.4, y = 290 + Math.sin(a) * r * 0.75;
      const tw = Math.max(0, Math.sin(lt * 7 + i * 1.7));
      ctx.fillStyle = '#fff'; starPath(ctx, x, y, 8 + 22 * tw, 4, 0.22); ctx.fill();
    }
  }
}
function drawIntro() {
  const t = introT, st = t < 1.15 ? 0 : t < 1.8 ? 1 : 2;
  const lt = t - [0, 1.15, 1.8][st], dur = [1.15, 0.65, 1.5][st], k = clamp(lt / dur, 0, 1);
  const ik = 'intro/intro_' + (st + 1), hasImg = Art.has(ik);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // 鏡頭:第 1 段緩慢推近、第 2 段瞬間拉近再回彈、第 3 段穩住(不抖動)
  const zf = hasImg ? 0.4 : 1;   // 正式滿版圖構圖很滿,推近幅度小一點才不會切到手臂/布片
  const zoom = st === 0 ? 1 + 0.16 * zf * k : st === 1 ? 1 + (0.12 + 0.3 * (1 - smooth(lt / 0.2))) * zf : 1.0 + 0.05 * zf * k;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  if (!Art.cover(ctx, ik, W, H)) introScene(st, lt);
  ctx.restore();
  // 文字與轉場(不放進鏡頭縮放裡)。整段動畫不放任何「效果字」,只保留第一段的旁白與轉場閃光
  if (st === 0) {
    ctx.globalAlpha = smooth(lt / 0.5);
    outlineText('…今年的聖誕老人,有點不一樣', W / 2, H - 38, 28, '#ffe9a8', '#1a1030');
    ctx.globalAlpha = 1;
  } else if (st === 1) {
    ctx.fillStyle = `rgba(255,255,255,${clamp(1 - lt / 0.22, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  } else if (st === 2) {
    ctx.fillStyle = `rgba(255,255,255,${clamp((lt - 1.3) / 0.2, 0, 1)})`; ctx.fillRect(0, 0, W, H);   // 轉場到遊戲
  }
  ctx.globalAlpha = 0.6; outlineText('點擊跳過', W - 70, H - 20, 16, '#fff', '#1a1030'); ctx.globalAlpha = 1;
}

function drawOver() {
  const k = smooth(overT / 0.6);
  ctx.fillStyle = `rgba(10,5,25,${0.78 * k})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  outlineText('聖誕節毀了...', W / 2, 62, 58, '#ff6b6b', '#3a0a10');
  outlineText('得分  ' + G.score, W / 2, 124, 46, '#ffe066', '#5a3a00');
  outlineText('最高連擊 ' + G.maxCombo + '   送出心意 ' + G.served + ' 次   時間 ' + Scores.fmtTime(Math.round(G.elapsed)), W / 2, 168, 20, '#fff', '#10204a');
  // 歷史排行榜
  const rows = Scores.load(), top = 200, rh = 34;
  ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, W / 2 - 280, top - 6, 560, rows.length * rh + 44, 14); ctx.fill();
  outlineText('歷史排行榜(本機前 5 名)', W / 2, top + 14, 20, '#bfe3ff', '#10204a');
  rows.forEach((e, i) => {
    const y = top + 48 + i * rh, me = i === G.rank;
    if (me) { ctx.fillStyle = `rgba(255,224,102,${0.18 + 0.1 * Math.sin(time * 6)})`; rr(ctx, W / 2 - 266, y - 15, 532, 30, 8); ctx.fill(); }
    const col = me ? '#ffe066' : i === 0 ? '#ffd166' : '#ffffff';
    outlineText(['①', '②', '③', '④', '⑤'][i], W / 2 - 240, y, 22, col, '#10204a');
    outlineText(String(e.score), W / 2 - 150, y, 24, col, '#10204a', 'center');
    outlineText('連擊 ' + e.combo, W / 2 + 10, y, 18, col, '#10204a');
    outlineText(Scores.fmtTime(e.secs) + '  ' + Scores.fmtDate(e.date), W / 2 + 150, y, 18, col, '#10204a');
    if (me) outlineText('NEW', W / 2 + 244, y, 16, '#ff5ea8', '#10204a');
  });
  if (!rows.length) outlineText('(這局沒有得分,下次加油)', W / 2, top + 70, 22, '#ccc', '#10204a');
  if (G.rank === 0) outlineText('★ 新紀錄!', W / 2 + 250, 124, 24, '#9bf6a8', '#10204a');
  if (overT > 0.8) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 5); outlineText('— 點擊再來一局 —', W / 2, H - 38, 34, '#fff', '#10204a'); ctx.globalAlpha = 0.8; outlineText('[H] 回首頁', W - 160, H - 66, 16, '#ffe9a8', '#10204a'); }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (state === 'intro') { drawIntro(); drawToggles(); return; }
  ctx.save();
  if (!Art.cover(ctx, 'scene/bg_main', W, H)) ctx.drawImage(bgCanvas, 0, 0);

  // FEVER 光
  const th = yetiThreshold(), hot = state === 'play' && !yeti && G.fever / th >= 0.75;
  if (hot || (yeti && yeti.phase === 'fight')) {
    const hue = (time * 160) % 360;
    const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 600);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `hsla(${hue},100%,60%,${0.28 + 0.1 * Math.sin(time * 10)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // 目標(依 y 排序)
  [...targets].sort((a, b) => a.y - b.y).forEach(drawTarget);

  // 雪怪
  if (yeti) {
    let rot = 0, alpha = 1, oy = yeti.dropY || 0, mood = yeti.mood;
    if (yeti.phase === 'dying') { const k = smooth(yeti.t / 1.8); rot = k * 0.5; oy = k * 200; alpha = 1 - k; }
    if (yeti.phase === 'fail') { const k = smooth((yeti.t - 1) / 0.6); oy = -k * 560; }
    drawYeti(ctx, { x: 480, y: H - 20 + oy, s: 1, t: time, hit: yeti.hit, mood, dmg: yeti.dmg, rot, alpha });
  }

  drawFigures();

  // 投擲物
  for (const p of projectiles) if (p.started) {
    // 拖尾:直線速度殘影
    const kk = clamp(p.t / p.dur, 0, 1), k0 = Math.max(0, kk - 0.6);
    ctx.save();
    ctx.strokeStyle = p.kind === 'gift' ? 'rgba(255,255,255,.7)' : 'rgba(255,150,30,.75)';
    ctx.lineCap = 'round'; ctx.lineWidth = 12 * p.size;
    ctx.beginPath(); ctx.moveTo(lerp(p.x0, p.tx, k0), lerp(p.y0, p.ty, k0)); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.lineWidth = 5 * p.size; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(lerp(p.x0, p.tx, k0 + (kk - k0) * 0.4), lerp(p.y0, p.ty, k0 + (kk - k0) * 0.4)); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.restore();
    drawItem(ctx, p.kind, p.x, p.y, p.size, p.rot);
  }

  // 粒子
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
    ctx.fillStyle = p.col;
    if (p.shape === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
    else if (p.shape === 'star') { starPath(ctx, p.x, p.y, p.size, 5, 0.45); ctx.fill(); }
    else if (p.shape === 'heart') { heartPath(p.x, p.y, p.size * 1.6); ctx.fill(); }
    else if (p.shape === 'ring') {
      const k = 1 - p.life / p.max;
      ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, 9 * (1 - k));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 2.4 * k), 0, TAU); ctx.stroke();
    } else if (p.shape === 'line') {
      const sp = Math.hypot(p.vx, p.vy) || 1, l = p.size * 2;
      ctx.strokeStyle = p.col; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / sp * l, p.y - p.vy / sp * l); ctx.stroke();
    }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // 前景雪
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const f of flakes) { ctx.globalAlpha = 0.4 + 0.4 * f.z / 1.4; ctx.beginPath(); ctx.arc(f.x, f.y, 1.4 * f.z + 0.6, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;

  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life / t.max * 2, 0, 1);
    if (t.pow) {
      // 漫畫爆炸框:先放大過衝再縮回
      const k = 1 - t.life / t.max;
      const sc = k < 0.18 ? 0.3 + (k / 0.18) * 1.0 : 1.3 - 0.3 * Math.min(1, (k - 0.18) / 0.25);
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot); ctx.scale(sc, sc);
      starPath(ctx, 0, 0, t.size * 1.05, 10, 0.62); ctx.fillStyle = t.bg; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#1a1030'; ctx.lineJoin = 'round'; ctx.stroke();
      outlineText(t.txt, 0, 2, t.size * 0.6, '#fff', '#1a1030');
      ctx.restore();
      continue;
    }
    outlineText(t.txt, t.x, t.y, t.size, t.col, '#1a1030');
  }
  ctx.globalAlpha = 1;
  if (state === 'play') drawBubble();
  if (muscle) drawMuscle();
  ctx.restore();

  if (state === 'play' || state === 'over') drawHUD();
  else drawToggles();   // 標題畫面也能開關音效/震動
  drawOverlays();
  if (state === 'title') drawTitle();
  if (state === 'over') drawOver();
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
    outlineText('暫停', W / 2, 220, 80, '#fff', '#10204a');
    outlineText('點擊或按 P 繼續', W / 2, 300, 28, '#bfe3ff', '#10204a');
    outlineText('按 H 或右下角「首頁」回入口頁', W / 2, 345, 20, '#ffe9a8', '#10204a');
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 除錯用:?debug 可在 console 呼叫
window.__cog = { checkLayout, G, santa, targets, clones, startGame, get yeti() { return yeti; }, startYeti, setCombo(n) { G.combo = n; }, setFever(n) { G.fever = n; } };
