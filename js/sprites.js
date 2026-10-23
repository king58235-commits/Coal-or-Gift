'use strict';
// ============================================================
//  程式繪製的「暫代角色」。
//  之後換成正式美術時,只要保留下面這些 draw 函式的介面,
//  把內容改成 drawImage 即可,game.js 不用動。
//    drawItem(ctx, kind, x, y, size, rot)       禮物 / 煤炭
//    drawSanta(ctx, o)                          肌肉聖誕老人(含分身)
//    drawKid(ctx, o)                            好小孩 / 流氓 / 哥布林
//    drawYeti(ctx, o)                           雪怪
// ============================================================
const TAU = Math.PI * 2;
const SKIN = '#f2b48c', SKIN_D = '#d98d62';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function limb(ctx, x1, y1, x2, y2, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function starPath(ctx, x, y, r, n, inner) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = i * Math.PI / n - Math.PI / 2, rad = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

// ---------------- 物品 ----------------
function drawItem(ctx, kind, x, y, size, rot) {
  if (typeof Art !== 'undefined' && Art.item(ctx, kind, x, y, size, rot)) return;   // 有正式圖就用圖
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(size, size);
  if (kind === 'gift') {
    ctx.fillStyle = '#e63946'; rr(ctx, -15, -13, 30, 28, 4); ctx.fill();
    ctx.fillStyle = '#c1121f'; rr(ctx, -17, -17, 34, 10, 3); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-4, -17, 8, 32);
    ctx.fillRect(-15, -2, 30, 7);
    ctx.beginPath(); ctx.ellipse(-8, -21, 8, 5, -0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -21, 8, 5, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(-12, 8); ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#1b1b1f';
    ctx.beginPath();
    ctx.moveTo(-15, 2); ctx.lineTo(-9, -12); ctx.lineTo(2, -16); ctx.lineTo(14, -8);
    ctx.lineTo(16, 6); ctx.lineTo(7, 15); ctx.lineTo(-8, 14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a4a55';
    ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(2, -16); ctx.lineTo(-1, -6); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(16, 6); ctx.lineTo(9, 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ff7b00'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(2, 8); ctx.lineTo(5, 3); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------- 肌肉聖誕老人 ----------------
const SANTA_PALS = [
  { coat: '#d62828', coatD: '#a31d1d', hat: '#d62828' },
  { coat: '#2a9d8f', coatD: '#1d7168', hat: '#2a9d8f' },
  { coat: '#8e44ad', coatD: '#5f2c82', hat: '#8e44ad' },
  { coat: '#f48c06', coatD: '#c26d00', hat: '#f48c06' },
  { coat: '#3a86ff', coatD: '#2663c4', hat: '#3a86ff' },
  { coat: '#ff4d9a', coatD: '#c9336f', hat: '#ff4d9a' },
  { coat: '#4caf50', coatD: '#357a38', hat: '#4caf50' },
  { coat: '#2b2d42', coatD: '#14151f', hat: '#2b2d42' },
];

// 肩膀在原點、角度 0 = 向外水平、-π/2 = 向上。回傳手的位置。
function drawArm(ctx, a1, a2, bf, pal, clothed) {
  const L1 = 54, L2 = 50;
  const ex = Math.cos(a1) * L1, ey = Math.sin(a1) * L1;
  const hx = ex + Math.cos(a2) * L2, hy = ey + Math.sin(a2) * L2;
  limb(ctx, 0, 0, ex, ey, 30, SKIN);
  // 二頭肌隆起
  const nx = Math.sin(a1), ny = -Math.cos(a1);
  const bx = ex * 0.5 + nx * 9 * bf, by = ey * 0.5 + ny * 9 * bf;
  ctx.fillStyle = SKIN; circ(ctx, bx, by, 15 * bf + 5); ctx.fill();
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(bx, by, 11 * bf + 3, a1 + 0.3, a1 + 2.2); ctx.stroke();
  // 前臂 + 拳頭
  limb(ctx, ex, ey, hx, hy, 26, SKIN);
  ctx.fillStyle = SKIN; circ(ctx, ex, ey, 14); ctx.fill();
  ctx.fillStyle = SKIN; circ(ctx, hx, hy, 15); ctx.fill();
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx - 6, hy + 4); ctx.moveTo(hx + 1, hy - 8); ctx.lineTo(hx + 1, hy + 4); ctx.stroke();
  if (clothed) {
    // 無袖肩套(白毛邊)
    ctx.fillStyle = pal.coat; circ(ctx, 0, 0, 22); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke();
  } else {
    // 光著上身:三角肌(肩膀的圓肌肉)
    ctx.fillStyle = SKIN; circ(ctx, 0, 0, 24); ctx.fill();
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 17, 0.2, 1.7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-4, -9, 9, 5, -0.4, 0, TAU); ctx.fill();
  }
  return { x: hx, y: hy };
}

function lerpA(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function sm(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

function armPose(o, side, t) {
  const pose = o.pose;
  const s = side === 'R' ? 1 : -1;
  if (pose === 'cross') {   // 開場:雙臂交叉用力抓住胸前衣服(發抖蓄力)
    const k = Math.sin(t * 38) * 0.03;
    return [2.3 + k, -2.6 + k];
  }
  if (pose === 'tear') return [-0.18, -0.05];   // 爆衣:雙臂向兩側大大張開
  if (pose === 'flex') return [0.05 + Math.sin(t * 6 + (s > 0 ? 0 : 1)) * 0.06, -1.5];
  if (pose === 'dance') {
    const a = -1.15 + Math.sin(t * 9 + (s > 0 ? 0 : Math.PI)) * 0.6;
    return [a, a - 0.35];
  }
  if (pose === 'disco') {
    if (s > 0) { const k = Math.sin(t * 6); return [-0.75 + k * 0.15, -0.6 + k * 0.1]; }
    return [0.95, 0.7];
  }
  if (pose === 'pump') {
    const k = Math.sin(t * 10 + (s > 0 ? 0 : Math.PI));
    return [-1.0 + k * 0.4, -1.55];
  }
  // 'throw'
  if (side === 'L') return [0.5, -1.4];
  const idle = [-0.25 + Math.sin(t * 2.5) * 0.05, -1.25];
  const a = o.aim || 0;
  const wind = [a + 2.1, a + 2.6], rel = [a - 0.05, a - 0.05];   // 大幅度向後拉再甩出
  const T = o.throwT;
  if (T == null || T < 0) return idle;
  if (T < 0.32) return lerpA(idle, wind, sm(T / 0.32));
  if (T < 0.5) return lerpA(wind, rel, sm((T - 0.32) / 0.18));
  return lerpA(rel, idle, sm((T - 0.5) / 0.5));
}

// o: x,y(腳底) s dir t pose aim throwT item(null|'gift'|'coal') pal bf
function drawSanta(ctx, o) {
  if (typeof Art !== 'undefined' && Art.santa(ctx, o)) return;   // 有正式圖就用圖(缺圖退回下面的程式繪製)
  const t = o.t || 0, pal = o.pal || SANTA_PALS[0], pose = o.pose || 'throw';
  const bf = o.bf || 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  let sway = 0, bob = 0;
  if (pose === 'dance') { sway = Math.sin(t * 6) * 0.07; bob = -Math.abs(Math.sin(t * 6)) * 12; }
  else if (pose === 'disco') { sway = Math.sin(t * 5) * 0.05; bob = -Math.abs(Math.sin(t * 10)) * 6; }
  else if (pose === 'pump') { bob = -Math.abs(Math.sin(t * 9)) * 14; }
  else if (pose === 'flex') { bob = Math.sin(t * 4) * 3; }
  else { bob = Math.sin(t * 2.5) * 2; }
  ctx.scale(o.s * (o.dir || 1), o.s);
  // 投擲的全身發力:蓄力時身體後仰,出手瞬間整個人往前撲出去,再彈回
  let lean = 0, lunge = 0;
  const TT = o.throwT;
  if (pose === 'throw' && TT != null && TT >= 0) {
    if (TT < 0.32) { const k = sm(TT / 0.32); lean = -0.14 * k; lunge = -8 * k; }
    else if (TT < 0.5) { const k = sm((TT - 0.32) / 0.18); lean = -0.14 + 0.32 * k; lunge = -8 + 30 * k; }
    else { const k = sm((TT - 0.5) / 0.5); lean = 0.18 * (1 - k); lunge = 22 * (1 - k); }
  }
  ctx.translate(lunge, bob); ctx.rotate(sway + lean);

  // 影子
  ctx.save(); ctx.translate(0, -bob);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 70, 12, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // 禮物袋(只有主角)
  if (o.sack) {
    ctx.fillStyle = '#8d5a2b'; ctx.beginPath();
    ctx.moveTo(-112, -2); ctx.bezierCurveTo(-140, -50, -122, -84, -96, -78);
    ctx.bezierCurveTo(-72, -66, -70, -20, -80, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6e4220'; ctx.fillRect(-122, -80, 34, 10);
    drawItem(ctx, 'gift', -112, -88, 0.9, -0.3);
    drawItem(ctx, 'coal', -92, -90, 0.9, 0.4);
  }

  // 腿 + 靴
  ctx.fillStyle = o.clothed ? pal.coatD : pal.coat; rr(ctx, -38, -78, 32, 62, 8); ctx.fill(); rr(ctx, 6, -78, 32, 62, 8); ctx.fill();
  ctx.fillStyle = '#17171c'; rr(ctx, -44, -22, 42, 22, 8); ctx.fill(); rr(ctx, 2, -22, 42, 22, 8); ctx.fill();

  // 軀幹
  if (o.clothed) {
    // (開場動畫用)穿著紅色外套
    ctx.save();
      const puff = 1 + 0.03 * (bf - 1);
      ctx.scale(puff, 1);
      ctx.fillStyle = pal.coat;
      ctx.beginPath();
      ctx.moveTo(-74, -184); ctx.quadraticCurveTo(-80, -140, -56, -96);
      ctx.lineTo(-62, -70); ctx.lineTo(62, -70); ctx.lineTo(56, -96);
      ctx.quadraticCurveTo(80, -140, 74, -184); ctx.quadraticCurveTo(0, -206, -74, -184);
      ctx.closePath(); ctx.fill();
      // 背肌陰影
      ctx.strokeStyle = pal.coatD; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -192); ctx.lineTo(0, -100); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -176); ctx.quadraticCurveTo(-50, -160, -48, -112); ctx.moveTo(8, -176); ctx.quadraticCurveTo(50, -160, 48, -112); ctx.stroke();
      // 腰帶
      ctx.fillStyle = '#17171c'; ctx.fillRect(-60, -112, 120, 14);
      ctx.fillStyle = '#ffd166'; rr(ctx, 40, -114, 18, 18, 3); ctx.fill();
      // 衣襬白毛
      ctx.fillStyle = '#fff'; rr(ctx, -66, -80, 132, 14, 7); ctx.fill();
      ctx.restore();
  } else {
    // 光著上身:倒三角肌肉(胸肌、腹肌、人魚線),只穿紅褲
    ctx.save();
    const puff = 1 + 0.03 * (bf - 1);
    ctx.scale(puff, 1);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.moveTo(-74, -184); ctx.quadraticCurveTo(-80, -140, -56, -96);
    ctx.lineTo(-62, -70); ctx.lineTo(62, -70); ctx.lineTo(56, -96);
    ctx.quadraticCurveTo(80, -140, 74, -184); ctx.quadraticCurveTo(0, -206, -74, -184);
    ctx.closePath(); ctx.fill();
    // 胸大肌(兩塊)
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.ellipse(-30, -165, 31, 21, 0.12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30, -165, 31, 21, -0.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-30, -168, 29, 0.25, 2.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(30, -168, 29, 0.25 - 0.1, 2.9 - 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -186); ctx.lineTo(0, -102); ctx.stroke();   // 中線
    // 腹肌(兩欄三列)
    ctx.lineWidth = 3;
    for (const yy of [-142, -126, -110]) { ctx.beginPath(); ctx.moveTo(-17, yy); ctx.lineTo(17, yy); ctx.stroke(); }
    ctx.fillStyle = SKIN_D; circ(ctx, 0, -118, 2); ctx.fill();
    // 人魚線
    ctx.beginPath(); ctx.moveTo(-52, -138); ctx.quadraticCurveTo(-38, -112, -24, -98); ctx.moveTo(52, -138); ctx.quadraticCurveTo(38, -112, 24, -98); ctx.stroke();
    // 乳頭
    ctx.fillStyle = '#d9806a'; circ(ctx, -30, -156, 3.5); ctx.fill(); circ(ctx, 30, -156, 3.5); ctx.fill();
    // 紅色長褲(褲頭一路蓋到髖部)
    ctx.fillStyle = pal.coat; rr(ctx, -62, -102, 124, 40, 10); ctx.fill();
    ctx.fillStyle = pal.coatD; ctx.fillRect(-62, -102, 124, 5);
    ctx.restore();
  }

  // 頭 ----------------------------------------------------
  // 後腦白髮
  ctx.fillStyle = '#f4f4f4'; circ(ctx, -8, -232, 37); ctx.fill();
  // 臉
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(16, -226, 29, 32, 0, 0, TAU); ctx.fill();
  // 大鬍子
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-6, -216);
  ctx.bezierCurveTo(-4, -158, 44, -150, 62, -208);
  ctx.quadraticCurveTo(30, -196, -6, -216); ctx.fill();
  // 嘴(大笑)
  ctx.fillStyle = '#5b1a1a'; ctx.beginPath(); ctx.arc(34, -202, 14, 0.05, Math.PI - 0.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(21, -201); ctx.lineTo(47, -201); ctx.lineTo(45, -195); ctx.lineTo(23, -195); ctx.closePath(); ctx.fill();
  // 鬍鬚
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(24, -209, 17, 7, -0.25, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(46, -209, 14, 6.5, 0.25, 0, TAU); ctx.fill();
  // 鼻
  ctx.fillStyle = '#f08a80'; circ(ctx, 52, -219, 8); ctx.fill();
  // 墨鏡
  ctx.fillStyle = '#0b0b10'; rr(ctx, 6, -240, 52, 19, 8); ctx.fill();
  ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, -233); ctx.lineTo(-14, -232); ctx.stroke();
  const gl = (t * 1.4) % 3;
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  if (gl < 0.5 || o.glint) {
    const gx = 10 + (gl / 0.5) * 44;
    ctx.save(); ctx.translate(gx, -231); ctx.rotate(0.5); ctx.fillRect(-2, -10, 4, 20); ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(12, -238, 14, 4);
  // 眉毛
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, -246); ctx.lineTo(54, -250); ctx.stroke();
  // 帽子(偽裝模式:換成小孩的毛帽,但鬍子和肌肉藏不住)
  if (o.disguise) {
    const dv = (o.dv || 0) % 3;
    if (o.disguise === 2) {
      // 偽裝成流氓:紅頭巾 + 莫霍克
      ctx.fillStyle = ['#ff3b30', '#ff9f1c', '#9b5de5'][dv];
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 12 - 7, -258); ctx.lineTo(4 + i * 12, -294 + Math.abs(i) * 7); ctx.lineTo(4 + i * 12 + 7, -258); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#d00000'; rr(ctx, -46, -266, 102, 20, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-40, -258); ctx.lineTo(-70, -246); ctx.lineTo(-44, -240); ctx.closePath(); ctx.fill();
    } else if (o.disguise === 3) {
      // 偽裝成哥布林:綠色大尖耳朵 + 破布帽
      ctx.fillStyle = '#7bc043';
      ctx.beginPath(); ctx.moveTo(-34, -240); ctx.lineTo(-92, -268); ctx.lineTo(-30, -212); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(62, -240); ctx.lineTo(112, -272); ctx.lineTo(60, -210); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8b5e34';
      ctx.beginPath(); ctx.arc(4, -250, 44, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b4423'; rr(ctx, -42, -262, 94, 16, 8); ctx.fill();
    } else {
      // 偽裝成好小孩:毛帽
      ctx.fillStyle = ['#3a86ff', '#ef476f', '#2ec4b6'][dv];
      ctx.beginPath(); ctx.arc(4, -250, 46, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; rr(ctx, -44, -262, 98, 20, 10); ctx.fill();
      ctx.fillStyle = '#ffd166'; circ(ctx, 4, -300, 14); ctx.fill();
    }
  } else {
    ctx.fillStyle = pal.hat;
    ctx.beginPath(); ctx.moveTo(-48, -248);
    ctx.bezierCurveTo(-52, -304, 12, -322, 54, -262); ctx.lineTo(46, -250); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal.hat; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-26, -298); ctx.quadraticCurveTo(-76, -300, -76, -244); ctx.stroke();
    ctx.fillStyle = '#fff'; circ(ctx, -76, -236, 13); ctx.fill();
    ctx.fillStyle = '#fff'; rr(ctx, -52, -262, 108, 22, 11); ctx.fill();
  }

  // 手臂 ---------------------------------------------------
  // 左手(遠端):以 scale(-1) 鏡像繪製
  ctx.save(); ctx.translate(-72, -176); ctx.scale(-1, 1);
  const la = armPose(o, 'L', t);
  drawArm(ctx, la[0], la[1], bf, pal, o.clothed);
  ctx.restore();
  // 右手(投擲手)
  ctx.save(); ctx.translate(72, -176);
  const ra = armPose(o, 'R', t);
  const hand = drawArm(ctx, ra[0], ra[1], bf, pal, o.clothed);
  if (o.item && (o.throwT == null || o.throwT < 0.3 || o.throwT > 0.7)) {
    const pop = (o.throwT != null && o.throwT > 0.7) ? 0.7 + 0.3 * sm((o.throwT - 0.7) / 0.3) : 1;
    drawItem(ctx, o.item, hand.x, hand.y - 18, 1.15 * pop, Math.sin(t * 3) * 0.1);
  }
  ctx.restore();

  ctx.restore();
}

// ---------------- 小孩 / 壞蛋 ----------------
function eyeOpen(ctx, x, y, r, pr, pcol) {
  ctx.fillStyle = '#fff'; circ(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = pcol || '#222'; circ(ctx, x, y + 0.5, pr); ctx.fill();
  ctx.fillStyle = '#fff'; circ(ctx, x - pr * 0.35, y - pr * 0.4, pr * 0.35); ctx.fill();
}
function eyeHappy(ctx, x, y, r) {
  ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y + 2, r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}
function eyeDizzy(ctx, x, y, r, t) {
  ctx.fillStyle = '#fff'; circ(ctx, x, y, r); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = i * 0.7 + t * 8, rad = r * 0.15 + (i / 20) * r * 0.8;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.stroke();
}
function tears(ctx, x, y, t, len) {
  ctx.fillStyle = 'rgba(90,170,255,.9)';
  for (let k = 0; k < 2; k++) {
    const ph = (t * 3 + k * 0.5) % 1;
    ctx.beginPath(); ctx.ellipse(x + (k ? 3 : -2), y + ph * len, 3, 5, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(90,170,255,.55)'; ctx.fillRect(x - 1.5, y, 3, len * 0.6);
}
function soot(ctx, cx, cy, r) {
  ctx.fillStyle = 'rgba(20,14,14,.82)';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, TAU); ctx.fill();
}
function haloAt(ctx, y, t) {
  ctx.save();
  ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 12;
  ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, y + Math.sin(t * 4) * 2, 19, 6, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
function orbitStars(ctx, cy, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 6 + i * TAU / 3;
    ctx.fillStyle = '#ffe066'; starPath(ctx, Math.cos(a) * 32, cy - 24 + Math.sin(a) * 8, 6, 5, 0.45); ctx.fill();
  }
}

function drawKid(ctx, o) {
  const k = o.kind, m = o.mood, t = o.t;
  ctx.save();
  if (m === 'happy' || m === 'conv') ctx.translate(0, -Math.abs(Math.sin(t * 11)) * 16);
  else if (m === 'cry') ctx.translate(Math.sin(t * 45) * 2, 0);
  else if (m === 'smug') ctx.translate(Math.sin(t * 30) * 2, -Math.abs(Math.sin(t * 14)) * 6);
  else if (m === 'coal') ctx.translate(Math.sin(t * 20) * 3, 0);
  else ctx.translate(0, Math.sin(t * 4 + (o.v || 0) * 2) * 2);
  if (typeof Art !== 'undefined' && Art.kid(ctx, o)) { /* 已用正式圖繪製 */ }
  else if (k === 'good') kidGood(ctx, o);
  else if (k === 'thug') kidThug(ctx, o);
  else kidGoblin(ctx, o);
  ctx.restore();
}

function kidGood(ctx, o) {
  const m = o.mood, t = o.t, v = (o.v || 0) % 3;
  const coat = ['#3a86ff', '#2ec4b6', '#ffb703'][v], hat = ['#ef476f', '#ffd166', '#8338ec'][v];
  ctx.fillStyle = '#4a3b3b'; rr(ctx, -15, -16, 13, 16, 5); ctx.fill(); rr(ctx, 2, -16, 13, 16, 5); ctx.fill();
  ctx.fillStyle = coat; rr(ctx, -22, -64, 44, 54, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(ctx, -2, -54, 4, 42, 2); ctx.fill();
  // 手臂
  for (const sd of [-1, 1]) {
    let hx, hy;
    if (m === 'happy' || m === 'conv') { hx = sd * 30; hy = -102 - Math.abs(Math.sin(t * 11)) * 6; }
    else if (m === 'cry') { hx = sd * 13; hy = -80; }
    else { hx = sd * 36; hy = -76 + Math.sin(t * 6 + sd) * 7; }
    limb(ctx, sd * 19, -54, hx, hy, 10, coat);
    ctx.fillStyle = hat; circ(ctx, hx, hy, 6.5); ctx.fill();
  }
  // 圍巾
  ctx.fillStyle = '#e63946'; rr(ctx, -25, -69, 50, 13, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-12, -69, 5, 13); ctx.fillRect(6, -69, 5, 13);
  ctx.fillStyle = '#e63946'; rr(ctx, 9, -60, 10, 26, 4); ctx.fill();
  // 頭
  ctx.fillStyle = '#ffd9b3'; circ(ctx, 0, -88, 25); ctx.fill();
  ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(0, -92, 26, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, -27, -95, 54, 11, 5); ctx.fill();
  ctx.fillStyle = '#fff'; circ(ctx, 0, -120, 8); ctx.fill();
  // 臉
  if (m === 'cry') {
    soot(ctx, 0, -86, 25);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 14, -90); ctx.lineTo(sd * 6, -84); ctx.lineTo(sd * 14, -80); ctx.stroke(); }
    tears(ctx, -10, -80, t, 22); tears(ctx, 10, -80, t + 0.3, 22);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -68, 8, 7 + Math.sin(t * 20) * 2, 0, 0, TAU); ctx.fill();
  } else if (m === 'happy' || m === 'conv') {
    eyeHappy(ctx, -9, -86, 6); eyeHappy(ctx, 9, -86, 6);
    ctx.fillStyle = '#7a2e2e'; ctx.beginPath(); ctx.arc(0, -78, 9, 0.05, Math.PI - 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,100,120,.45)'; circ(ctx, -16, -76, 5); ctx.fill(); circ(ctx, 16, -76, 5); ctx.fill();
  } else {
    eyeOpen(ctx, -9, -86, 7, 4.2); eyeOpen(ctx, 9, -86, 7, 4.2);
    ctx.strokeStyle = '#7a2e2e'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -80, 8, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,100,120,.45)'; circ(ctx, -16, -76, 5); ctx.fill(); circ(ctx, 16, -76, 5); ctx.fill();
  }
  if (m !== 'cry') haloAt(ctx, -128, t);
}

function badFaceOverride(ctx, m, t, cy, r) {
  if (m === 'idle' || m === 'rise') return false;
  if (m === 'smug') {
    eyeHappy(ctx, -10, cy, 6); eyeHappy(ctx, 10, cy, 6);
    ctx.fillStyle = '#4a0f0f'; ctx.beginPath(); ctx.ellipse(0, cy + 14, 14, 9 + Math.sin(t * 25) * 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e85d75'; ctx.beginPath(); ctx.ellipse(0, cy + 18, 8, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-10, cy + 6, 20, 4);
    return true;
  }
  if (m === 'coal') {
    soot(ctx, 0, cy + 2, r);
    eyeDizzy(ctx, -10, cy, 6, t); eyeDizzy(ctx, 10, cy, 6, t);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) ctx.lineTo(i * 4, cy + 16 + (i % 2 ? -3 : 2));
    ctx.stroke();
    tears(ctx, -13, cy + 6, t, 22); tears(ctx, 13, cy + 6, t + 0.4, 22);
    orbitStars(ctx, cy - r * 0.8, t);
    return true;
  }
  if (m === 'conv') {
    eyeHappy(ctx, -10, cy, 6); eyeHappy(ctx, 10, cy, 6);
    ctx.fillStyle = '#7a2e2e'; ctx.beginPath(); ctx.arc(0, cy + 8, 10, 0.05, Math.PI - 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,100,120,.5)'; circ(ctx, -17, cy + 8, 5); ctx.fill(); circ(ctx, 17, cy + 8, 5); ctx.fill();
    return true;
  }
  return false;
}

function kidThug(ctx, o) {
  const m = o.mood, t = o.t, v = (o.v || 0) % 3;
  const hoodie = ['#2b2d42', '#4a1c40', '#1b4332'][v], mohawk = ['#ff3b30', '#ff9f1c', '#9b5de5'][v];
  const skin = '#d9a273';
  ctx.fillStyle = '#3d405b'; rr(ctx, -20, -20, 17, 20, 5); ctx.fill(); rr(ctx, 3, -20, 17, 20, 5); ctx.fill();
  ctx.fillStyle = '#111'; rr(ctx, -23, -9, 22, 9, 3); ctx.fill(); rr(ctx, 1, -9, 22, 9, 3); ctx.fill();
  ctx.fillStyle = hoodie; rr(ctx, -29, -70, 58, 58, 16); ctx.fill();
  ctx.fillStyle = '#ffffff22'; rr(ctx, -12, -32, 24, 14, 4); ctx.fill();
  // 手臂
  const up = m === 'smug' || m === 'conv';
  const cover = m === 'coal';
  // 左拳
  { const hx = up ? -38 : cover ? -14 : -40, hy = up ? -98 : cover ? -90 : -64 + Math.sin(t * 8) * 4;
    limb(ctx, -26, -58, hx, hy, 13, hoodie); ctx.fillStyle = skin; circ(ctx, hx, hy, 8); ctx.fill(); }
  // 右手(球棒)
  { const hx = up ? 38 : cover ? 14 : 36, hy = up ? -98 : cover ? -90 : -86;
    limb(ctx, 26, -58, hx, hy, 13, hoodie);
    if (!cover) { ctx.strokeStyle = '#8d5a2b'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - 6, hy + 12); ctx.lineTo(hx + 12, hy - 40); ctx.stroke();
      ctx.fillStyle = '#ccc'; circ(ctx, hx + 5, hy - 20, 2); ctx.fill(); circ(ctx, hx + 8, hy - 30, 2); ctx.fill(); }
    ctx.fillStyle = skin; circ(ctx, hx, hy, 8); ctx.fill(); }
  // 金鍊 + 鉚釘
  ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -70, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#bbb'; for (const sx of [-22, -14, 14, 22]) { circ(ctx, sx, -66, 2.3); ctx.fill(); }
  // 頭
  ctx.fillStyle = skin; circ(ctx, 0, -92, 27); ctx.fill();
  // 莫霍克
  ctx.fillStyle = mohawk;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 7 - 5, -112); ctx.lineTo(i * 7, -134 + Math.abs(i) * 5); ctx.lineTo(i * 7 + 5, -112); ctx.closePath(); ctx.fill(); }
  // 頭巾
  ctx.fillStyle = '#d00000'; rr(ctx, -28, -112, 56, 14, 5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-26, -104); ctx.lineTo(-44, -96 + Math.sin(t * 6) * 3); ctx.lineTo(-30, -92); ctx.closePath(); ctx.fill();
  // 耳環
  ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2.4; circ(ctx, -27, -82, 4); ctx.stroke();
  if (!badFaceOverride(ctx, m, t, -90, 27)) {
    // 兇相
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, -102); ctx.lineTo(-4, -94); ctx.moveTo(20, -102); ctx.lineTo(4, -94); ctx.stroke();
    eyeOpen(ctx, -10, -88, 5.5, 2.6, '#c1121f'); eyeOpen(ctx, 10, -88, 5.5, 2.6, '#c1121f');
    // 疤痕
    ctx.strokeStyle = '#8a2b2b'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(15, -100); ctx.lineTo(21, -76); ctx.stroke();
    ctx.lineWidth = 1.6; for (const yy of [-95, -88, -81]) { ctx.beginPath(); ctx.moveTo(13, yy); ctx.lineTo(23, yy + 2); ctx.stroke(); }
    // 獰笑
    ctx.fillStyle = '#2a0808'; ctx.beginPath(); ctx.moveTo(-13, -76); ctx.lineTo(13, -79); ctx.lineTo(11, -69); ctx.lineTo(-10, -68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-9, -76); ctx.lineTo(-5, -76); ctx.lineTo(-7, -70); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -78); ctx.lineTo(10, -78); ctx.lineTo(8, -71); ctx.closePath(); ctx.fill();
  }
  if (m === 'conv') haloAt(ctx, -142, t);
}

function kidGoblin(ctx, o) {
  const m = o.mood, t = o.t, v = (o.v || 0) % 3;
  const green = ['#7bc043', '#5fa33f', '#8fcf58'][v];
  const greenD = '#3f7d2a';
  // 腳
  ctx.fillStyle = green; ctx.beginPath(); ctx.ellipse(-10, -4, 11, 5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(10, -4, 11, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = green; rr(ctx, -14, -26, 10, 22, 4); ctx.fill(); rr(ctx, 4, -26, 10, 22, 4); ctx.fill();
  // 破布衣
  ctx.fillStyle = '#8b5e34'; ctx.beginPath();
  ctx.moveTo(-22, -62); ctx.lineTo(22, -62); ctx.lineTo(24, -22);
  for (let i = 0; i < 5; i++) { ctx.lineTo(24 - (i + 0.5) * 9.6, -14 + (i % 2) * 4 - 4); ctx.lineTo(24 - (i + 1) * 9.6, -22); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b4423'; ctx.fillRect(-22, -42, 44, 4);
  // 抱著偷來的禮物
  const gy = -42 + Math.sin(t * 7) * 1.5;
  drawItem(ctx, 'gift', 16, gy, 0.62, 0.3);
  // 手
  const up = m === 'smug' || m === 'conv', cover = m === 'coal';
  for (const sd of [-1, 1]) {
    let hx = sd * 30, hy = -56 + Math.sin(t * 9 + sd) * 3;
    if (up) { hx = sd * 34; hy = -92; }
    if (cover) { hx = sd * 14; hy = -84; }
    if (sd === 1 && !up && !cover) { hx = 18; hy = -46; }
    limb(ctx, sd * 20, -58, hx, hy, 8, green);
    ctx.fillStyle = green; circ(ctx, hx, hy, 6); ctx.fill();
  }
  // 大耳朵
  ctx.fillStyle = green;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * 24, -98); ctx.lineTo(sd * (66 + Math.sin(t * 5) * 2), -112); ctx.lineTo(sd * 26, -76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e59aa0'; ctx.beginPath(); ctx.moveTo(sd * 30, -95); ctx.lineTo(sd * 54, -105); ctx.lineTo(sd * 31, -82); ctx.closePath(); ctx.fill();
    ctx.fillStyle = green;
  }
  // 頭
  ctx.fillStyle = green; circ(ctx, 0, -88, 28); ctx.fill();
  ctx.strokeStyle = greenD; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -116); ctx.lineTo(-10, -126); ctx.moveTo(4, -116); ctx.lineTo(8, -128); ctx.stroke();
  if (!badFaceOverride(ctx, m, t, -90, 28)) {
    // 邪眼
    ctx.fillStyle = '#ffe66d'; circ(ctx, -11, -92, 8); ctx.fill(); circ(ctx, 11, -92, 8); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(-12, -98, 2.4, 12); ctx.fillRect(10, -98, 2.4, 12);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-22, -106); ctx.lineTo(-4, -98); ctx.moveTo(22, -106); ctx.lineTo(4, -98); ctx.stroke();
    // 大鼻子
    ctx.fillStyle = greenD; circ(ctx, 0, -83, 7); ctx.fill();
    ctx.fillStyle = '#2f5d20'; circ(ctx, 4, -86, 1.8); ctx.fill();
    // 鋸齒嘴
    ctx.fillStyle = '#2a0808'; rr(ctx, -15, -77, 30, 12, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { ctx.moveTo(-14 + i * 5, -77); ctx.lineTo(-11.5 + i * 5, -70); ctx.lineTo(-9 + i * 5, -77); }
    ctx.fill();
  }
  if (m === 'conv') haloAt(ctx, -128, t);
}

// ---------------- 雪怪 ----------------
// o: x,y(腳底) s t hit(0..1) mood('idle'|'roar'|'dizzy'|'eat') dmg(0..1) rot alpha
function drawYeti(ctx, o) {
  if (typeof Art !== 'undefined' && Art.yeti(ctx, o)) return;
  const t = o.t, hit = o.hit || 0, mood = o.mood || 'idle';
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot || 0);
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  const shake = hit * 6;
  ctx.translate(Math.sin(t * 60) * shake, 0);
  ctx.scale(o.s, o.s);
  const breathe = Math.sin(t * 3) * 6;

  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 230, 26, 0, 0, TAU); ctx.fill();

  // 腳
  ctx.fillStyle = '#d6e6fb';
  ctx.beginPath(); ctx.ellipse(-90, -22, 70, 34, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(90, -22, 70, 34, 0, 0, TAU); ctx.fill();

  // 手臂(後)
  const armUp = mood === 'roar' ? -0.35 : 0;
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 200, -230);
    ctx.rotate(sd * (0.35 + armUp) + Math.sin(t * 3 + sd) * 0.08);
    ctx.fillStyle = '#e9f2ff'; ctx.beginPath(); ctx.ellipse(0, 90, 62, 130, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a9c8ec'; circ(ctx, 0, 190, 58); ctx.fill();
    ctx.fillStyle = '#5f86b4';
    for (const fx of [-26, 0, 26]) { ctx.beginPath(); ctx.moveTo(fx - 8, 226); ctx.lineTo(fx, 250); ctx.lineTo(fx + 8, 226); ctx.fill(); }
    ctx.restore();
  }
  // 身體
  const g = ctx.createRadialGradient(0, -200, 40, 0, -190, 230);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b7d2f2');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -180 + breathe * 0.4, 205, 175 + breathe * 0.5, 0, 0, TAU); ctx.fill();
  // 毛尖
  ctx.fillStyle = '#e4efff';
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.05 + 0.9 * i / 25), rx = 205, ry = 175;
    const px = Math.cos(a) * rx, py = -180 + Math.sin(a) * ry;
    ctx.beginPath(); ctx.moveTo(px - 12, py - 6); ctx.lineTo(px + Math.cos(a) * 20, py + Math.sin(a) * 26); ctx.lineTo(px + 12, py - 6); ctx.fill();
  }
  // 肚皮
  ctx.fillStyle = '#d8e8fb'; ctx.beginPath(); ctx.ellipse(0, -150, 110, 110, 0, 0, TAU); ctx.fill();
  // 被煤炭砸黑的污漬
  const blots = Math.floor((o.dmg || 0) * 14);
  ctx.fillStyle = 'rgba(25,20,24,.78)';
  for (let i = 0; i < blots; i++) {
    const a = i * 2.399, rr2 = 40 + (i * 37) % 150;
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr2 * 0.9, -190 + Math.sin(a) * rr2 * 0.7, 20 + (i % 3) * 8, 14 + (i % 4) * 5, a, 0, TAU); ctx.fill();
  }
  // 頭
  const hy = -318 + breathe * 0.3;
  ctx.fillStyle = '#eef5ff'; circ(ctx, 0, hy, 104); ctx.fill();
  ctx.fillStyle = '#a9c8ec'; ctx.beginPath(); ctx.ellipse(0, hy + 10, 82, 72, 0, 0, TAU); ctx.fill();
  // 犄角
  ctx.fillStyle = '#7fd4ff';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 62, hy - 78); ctx.quadraticCurveTo(sd * 110, hy - 110, sd * 96, hy - 160); ctx.quadraticCurveTo(sd * 76, hy - 120, sd * 38, hy - 90); ctx.fill(); }
  const dm = (o.dmg || 0);
  if (dm > 0.15) { ctx.fillStyle = 'rgba(25,20,24,.78)'; ctx.beginPath(); ctx.ellipse(-30, hy - 10, 30, 22, 0.4, 0, TAU); ctx.fill(); }
  if (dm > 0.5) { ctx.fillStyle = 'rgba(25,20,24,.78)'; ctx.beginPath(); ctx.ellipse(40, hy + 20, 26, 20, -0.3, 0, TAU); ctx.fill(); }
  // 眼睛
  if (mood === 'dizzy') {
    for (const sd of [-1, 1]) {
      ctx.strokeStyle = '#1d2a44'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sd * 40 - 14, hy - 24); ctx.lineTo(sd * 40 + 14, hy - 2); ctx.moveTo(sd * 40 + 14, hy - 24); ctx.lineTo(sd * 40 - 14, hy - 2); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) { const a = t * 5 + i * TAU / 4; ctx.fillStyle = '#ffe066'; starPath(ctx, Math.cos(a) * 110, hy - 120 + Math.sin(a) * 16, 14, 5, 0.45); ctx.fill(); }
  } else {
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#fff200'; ctx.shadowColor = '#ffe000'; ctx.shadowBlur = 14; circ(ctx, sd * 40, hy - 14, 17); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#b00020'; circ(ctx, sd * 40 + (mood === 'eat' ? 0 : -sd * 2), hy - 12, 7); ctx.fill();
      ctx.strokeStyle = '#1d2a44'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sd * 72, hy - 52); ctx.lineTo(sd * 12, hy - 28); ctx.stroke();
    }
  }
  // 鼻
  ctx.fillStyle = '#1d2a44'; ctx.beginPath(); ctx.ellipse(0, hy + 14, 20, 14, 0, 0, TAU); ctx.fill();
  // 嘴
  const open = mood === 'roar' ? 1 : mood === 'eat' ? 0.5 + Math.abs(Math.sin(t * 14)) * 0.4 : mood === 'dizzy' ? 0.2 : 0.35 + hit * 0.5 + Math.abs(Math.sin(t * 5)) * 0.1;
  ctx.fillStyle = '#34091a'; ctx.beginPath(); ctx.ellipse(0, hy + 56, 52, 12 + open * 30, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e0526b'; ctx.beginPath(); ctx.ellipse(0, hy + 56 + open * 14, 30, 6 + open * 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * 40 - 9, hy + 46); ctx.lineTo(sd * 40, hy + 46 + 24 + open * 8); ctx.lineTo(sd * 40 + 9, hy + 46); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sd * 16 - 7, hy + 46); ctx.lineTo(sd * 16, hy + 46 + 16 + open * 4); ctx.lineTo(sd * 16 + 7, hy + 46); ctx.fill();
  }
  // 手臂(前,拳頭)
  ctx.restore();
  if (hit > 0.05) {
    ctx.save(); ctx.globalAlpha = hit * 0.35; ctx.fillStyle = '#fff';
    ctx.translate(o.x, o.y); ctx.scale(o.s, o.s);
    ctx.beginPath(); ctx.ellipse(0, -230, 230, 230, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
