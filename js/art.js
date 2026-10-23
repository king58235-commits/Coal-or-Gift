'use strict';
// ============================================================
//  圖片載入器 + 關鍵幀播放。
//  - 有正式圖片就用圖片;缺圖(或還沒載完)自動退回 sprites.js 的程式繪製,遊戲永遠能玩。
//  - 動作只用「少量關鍵幀整張切換」,彈跳/壓扁/翻轉/染色/閃白都由程式做。
//  - 圖片清單由 tools/build_manifest.py 掃描 assets/ 產生 js/art_manifest.js(避免載入不存在的檔案產生 404)。
//  命名規則見 docs/ART_LIST.md。key = 檔案路徑去掉「assets/」與副檔名,例如 sprites/santa/idle。
// ============================================================
const Art = (() => {
  const M = window.ART_MANIFEST || { files: [], anchors: {}, units: {} };
  const imgs = {};
  let ready = false;

  // 各類角色在遊戲內的「單位高度」(整張圖高度 = 這個數字 × 縮放 s),腳底在圖片高度 footY 處
  const UNIT = Object.assign({ santa: 340, kidGood: 134, kidBad: 150, yeti: 460, item: 40 }, M.units || {});
  const FOOT_Y = 0.97;
  // 分身的色相偏移(只用紅~紫~橘,避免皮膚變藍綠)。索引對應 SANTA_PALS
  const HUE = [0, -30, -65, 28, -95, -15, 15, 0];

  const keyOf = p => p.replace(/^assets\//, '').replace(/\.[a-z0-9]+$/i, '');
  const has = k => !!imgs[k];
  const img = k => imgs[k];
  const anchor = k => (M.anchors && M.anchors[k]) || {};

  function load() {
    const files = M.files || [];
    if (!files.length) { ready = true; return Promise.resolve(); }
    return Promise.all(files.map(src => new Promise(res => {
      const im = new Image();
      im.onload = () => { imgs[keyOf(src)] = im; res(); };
      im.onerror = () => { console.warn('[Art] 圖片載入失敗,改用程式繪製:', src); res(); };
      im.src = src;
    }))).then(() => { ready = true; warmUp(); });
  }

  // 腳底(x 置中, y)對齊畫圖;h = 整張圖的繪製高度
  function drawFeet(ctx, im, x, y, h, footY) {
    const w = im.width * h / im.height;
    ctx.drawImage(im, x - w / 2, y - h * (footY == null ? FOOT_Y : footY), w, h);
    return w;
  }

  // 色相偏移快取:分身的帽子/褲子換色。
  // 重點:像素運算很貴(畫面上第一次出現某個分身時會卡頓),所以 ①只做一半解析度(分身很小,看不出差別)
  //      ②在載入完成後的空檔「預先」逐張算好,遊戲中絕不當場計算(還沒算好就先用原圖,不會卡)。
  const tintCache = {}, tintQueued = {};
  function buildTint(key, hue) {
    // 只改「飽和的純紅色」(帽子、褲子),膚色/鬍子/靴子保持原樣,避免分身變成粉紅或紫色皮膚
    const src = imgs[key], c = document.createElement('canvas');
    c.width = Math.ceil(src.width / 2); c.height = Math.ceil(src.height / 2);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), df = mx - mn;
      if (mx < 0.3 || df / mx < 0.8) continue;                          // 太暗或不夠飽和(膚色、白毛、外框)→ 不動
      let h = df === 0 ? 0 : mx === r ? ((gg - b) / df) % 6 : mx === gg ? (b - r) / df + 2 : (r - gg) / df + 4;
      h *= 60; if (h < 0) h += 360;
      if (h > 14 && h < 346) continue;                                  // 只處理純紅色範圍
      h = (h + hue + 360) % 360;
      const sat = df / mx, v = mx, cc = v * sat, x = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = v - cc;
      const [rr2, gg2, bb2] = h < 60 ? [cc, x, 0] : h < 120 ? [x, cc, 0] : h < 180 ? [0, cc, x] : h < 240 ? [0, x, cc] : h < 300 ? [x, 0, cc] : [cc, 0, x];
      px[i] = (rr2 + m) * 255; px[i + 1] = (gg2 + m) * 255; px[i + 2] = (bb2 + m) * 255;
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  const bgJobs = [];
  function pumpJobs() {                      // 每次只做一件,做完讓出主執行緒,不會拖慢畫面
    const j = bgJobs.shift();
    if (!j) return;
    try { j(); } catch (e) { /* 單一圖片失敗就略過 */ }
    setTimeout(pumpJobs, 0);
  }
  function tinted(key, hue) {
    if (!hue) return imgs[key];
    const ck = key + '@' + hue;
    if (tintCache[ck]) return tintCache[ck];
    if (!tintQueued[ck]) {                   // 還沒算好:先排進背景佇列,這一幀先用原圖
      tintQueued[ck] = true;
      bgJobs.push(() => { tintCache[ck] = buildTint(key, hue); });
      setTimeout(pumpJobs, 0);
    }
    return imgs[key];
  }
  // 載入完成後預先處理:①每張圖畫一次到 1×1 小畫布(強迫瀏覽器解碼/上傳,避免第一次顯示時卡)
  //                      ②預先算好所有分身會用到的換色版本
  function warmUp() {
    const tiny = document.createElement('canvas'); tiny.width = tiny.height = 1;
    const tg = tiny.getContext('2d');
    for (const k of Object.keys(imgs)) bgJobs.push(() => tg.drawImage(imgs[k], 0, 0, 1, 1));
    for (const k of Object.keys(imgs)) if (k.indexOf('sprites/santa/') === 0) {
      for (let pi = 1; pi <= 4; pi++) { const hue = HUE[pi]; if (hue) bgJobs.push(() => tinted(k, hue)); }
    }
    pumpJobs();
  }

  // 依優先順序找第一張存在的圖
  const firstOf = (base, names) => { for (const n of names) if (has(base + '/' + n)) return base + '/' + n; return null; };
  const pingpong = (t, fps, n) => { const p = Math.floor(t * fps) % (2 * n - 2 || 1); return p < n ? p : 2 * n - 2 - p; };

  // ---------------- 聖誕老人 ----------------
  function santaKey(o) {
    const pose = o.pose || 'throw', t = o.t || 0;
    if (o.disguise) {
      const base = 'sprites/' + ['fake_kid', 'fake_thug', 'fake_goblin'][(o.disguise - 1) % 3];
      return firstOf(base, pose === 'flex' ? ['flex', 'idle'] : ['idle', 'flex']);
    }
    const base = 'sprites/santa';
    if (pose === 'throw') {
      const T = o.throwT;
      if (T != null && T >= 0 && T < 0.32) return firstOf(base, ['windup', 'idle']);
      if (T != null && T >= 0.32 && T < 0.62) return firstOf(base, (o.aim != null && o.aim < -0.45) ? ['release_up', 'release_fwd', 'idle'] : ['release_fwd', 'release_up', 'idle']);
      return firstOf(base, ['idle', 'flex_1']);
    }
    if (pose === 'flex') return firstOf(base, [['flex_1', 'flex_2'][pingpong(t, 2.5, 2)], 'flex_1', 'idle']);
    if (pose === 'pump') return firstOf(base, [['pump_1', 'pump_2'][pingpong(t, 5, 2)], 'pump_1', 'dance_2', 'flex_1']);
    // dance / disco:3 張舞姿來回播放 1-2-3-2
    const d = ['dance_1', 'dance_2', 'dance_3'], i = pingpong(t + (pose === 'disco' ? 0.15 : 0), 5, 3);
    return firstOf(base, [d[i], 'dance_2', 'flex_1', 'idle']);
  }

  // 圖上的手(投擲手)位置,回傳相對於腳底的 {x,y}(已含縮放與左右翻轉)
  function santaHand(aim, s, dir) {
    if (!ready) return null;
    const key = firstOf('sprites/santa', (aim < -0.45) ? ['release_up', 'release_fwd'] : ['release_fwd', 'release_up']);
    if (!key) return null;
    const im = imgs[key], a = anchor(key).hand || [0.80, 0.30];
    const h = UNIT.santa * s, w = im.width * h / im.height;
    return { x: (a[0] - 0.5) * w * (dir || 1), y: (a[1] - FOOT_Y) * h };
  }

  function santa(ctx, o) {
    if (!ready || o.clothed) return false;   // 穿衣版只有程式繪製(開場動畫用)
    const key = santaKey(o);
    if (!key) return false;
    const t = o.t || 0, pose = o.pose || 'throw', s = o.s;
    let src = imgs[key];
    const palIdx = SANTA_PALS.indexOf(o.pal);
    if (palIdx > 0) src = tinted(key, HUE[palIdx] || 0);
    const h = UNIT.santa * s;
    // 動作:呼吸/跳舞的上下彈跳 + 投擲時蓄力後仰、出手前撲(跟程式繪製版相同的手感)
    let bob = 0, sway = 0, lean = 0, lunge = 0;
    if (pose === 'dance') { sway = Math.sin(t * 6) * 0.05; bob = -Math.abs(Math.sin(t * 6)) * 12; }
    else if (pose === 'disco') { sway = Math.sin(t * 5) * 0.04; bob = -Math.abs(Math.sin(t * 10)) * 6; }
    else if (pose === 'pump') bob = -Math.abs(Math.sin(t * 9)) * 14;
    else bob = Math.sin(t * 2.5) * 2;
    const TT = o.throwT;
    if (pose === 'throw' && TT != null && TT >= 0) {
      const sm = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
      if (TT < 0.32) { const k = sm(TT / 0.32); lean = -0.14 * k; lunge = -8 * k; }
      else if (TT < 0.5) { const k = sm((TT - 0.32) / 0.18); lean = -0.14 + 0.32 * k; lunge = -8 + 30 * k; }
      else { const k = sm((TT - 0.5) / 0.5); lean = 0.18 * (1 - k); lunge = 22 * (1 - k); }
    }
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 70 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();   // 影子
    ctx.scale(o.dir || 1, 1);
    ctx.translate(lunge * s, bob * s);
    ctx.rotate(sway + lean);
    const w = src.width * h / src.height;
    ctx.drawImage(src, -w / 2, -h * FOOT_Y, w, h);
    // 手裡的物品:疊在該幀的手部錨點上
    if (o.item && pose === 'throw' && (TT == null || TT < 0.3 || TT > 0.7)) {
      const ha = anchor(key).hand || [0.80, 0.30];
      drawItem(ctx, o.item, (ha[0] - 0.5) * w, (ha[1] - FOOT_Y) * h - 10 * s, 1.15 * s, Math.sin(t * 3) * 0.1);
    }
    ctx.restore();
    return true;
  }

  // ---------------- 小孩 / 壞蛋 ----------------
  function kid(ctx, o) {
    if (!ready) return false;
    const m = o.mood, t = o.t || 0, v = (o.v || 0) % 2;
    const base = o.kind === 'good' ? 'kid_good' : o.kind;
    let folder = 'sprites/' + base + '_' + (v ? 'b' : 'a');
    if (!firstOf(folder, ['idle', 'idle_1'])) folder = 'sprites/' + base + '_a';
    let names;
    if (o.kind === 'good') {
      if (m === 'happy' || m === 'conv') names = ['happy', 'idle_1', 'idle'];
      else if (m === 'cry') names = ['cry', 'idle_1', 'idle'];
      else names = [Math.floor(t * 3.5) % 2 ? 'idle_2' : 'idle_1', 'idle_1', 'idle'];
    } else {
      if (m === 'smug') names = ['smug', 'idle'];
      else if (m === 'coal') names = ['hit', 'idle'];
      else if (m === 'conv') names = ['converted', 'idle'];
      else names = ['idle'];
    }
    const key = firstOf(folder, names);
    if (!key) return false;
    const h = o.kind === 'good' ? UNIT.kidGood : UNIT.kidBad;
    drawFeet(ctx, imgs[key], 0, 0, h);
    return true;
  }

  // ---------------- 雪怪 ----------------
  function yeti(ctx, o) {
    if (!ready || !has('sprites/yeti/idle')) return false;
    const mood = o.mood || 'idle';
    const key = firstOf('sprites/yeti', [(o.hit || 0) > 0.25 ? 'hit' : '', mood === 'roar' ? 'roar' : mood === 'eat' ? 'eat' : mood === 'dizzy' ? 'dizzy' : '', 'idle'].filter(Boolean));
    const t = o.t || 0, shake = (o.hit || 0) * 6;
    ctx.save();
    ctx.translate(o.x + Math.sin(t * 60) * shake, o.y);
    ctx.rotate(o.rot || 0);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 230 * o.s, 26 * o.s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, Math.sin(t * 3) * 3);
    drawFeet(ctx, imgs[key], 0, 0, UNIT.yeti * o.s);
    if ((o.hit || 0) > 0.05) {   // 被打中的瞬間閃白
      ctx.globalAlpha *= o.hit * 0.3; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0, -230 * o.s, 200 * o.s, 220 * o.s, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return true;
  }

  // ---------------- 物品 / UI / 場景 ----------------
  function item(ctx, kind, x, y, size, rot) {
    if (!ready) return false;
    const key = kind === 'gift' ? (has('sprites/items/gift_red') ? 'sprites/items/gift_red' : null) : (has('sprites/items/coal') ? 'sprites/items/coal' : null);
    if (!key) return false;
    const im = imgs[key], h = UNIT.item * size;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.drawImage(im, -h * im.width / im.height / 2, -h / 2, h * im.width / im.height, h);
    ctx.restore();
    return true;
  }
  // 滿版圖(背景、肌肉秀):cover 填滿 960×540
  function cover(ctx, key, w, h) {
    if (!ready || !has(key)) return false;
    const im = imgs[key], k = Math.max(w / im.width, h / im.height);
    ctx.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k);
    return true;
  }
  function icon(ctx, key, x, y, size) {   // 以 (x,y) 為中心的方形圖示
    if (!ready || !has(key)) return false;
    const im = imgs[key]; ctx.drawImage(im, x - size / 2, y - size / 2, size, size * im.height / im.width);
    return true;
  }

  const api = { load, has, img, santa, santaHand, kid, yeti, item, cover, icon, get ready() { return ready; }, UNIT, files: M.files || [] };
  load();
  return api;
})();
