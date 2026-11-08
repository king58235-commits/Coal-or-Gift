'use strict';
// 全部用 WebAudio 即時合成,不需要音檔。
const Sfx = (() => {
  let ac = null, master = null, muted = false;
  try { muted = localStorage.getItem('cog_muted') === '1'; } catch (e) {}

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }

  function tone(f, d, type, v, slide, delay, dest) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
    g.gain.setValueAtTime(v == null ? 0.25 : v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + d + 0.03);
  }

  let noiseBuf = null;
  function noise(d, v, freq, type, delay, sweep, dest) {
    if (!ac) return;
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const a = noiseBuf.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.setValueAtTime(freq || 1000, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(v == null ? 0.3 : v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(dest || master);
    s.start(t); s.stop(t + d + 0.03);
  }

  // ---------------- 背景音樂(Jingle Bells,1857,公有領域) ----------------
  // 同一段旋律兩種編曲:平常是輕快的雪橇鈴,雪怪戰是加了鼓點的搖滾版。
  // 排程用 WebAudio 時鐘,所以 beat() 可以直接當節奏判定的時間基準。
  const B = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67 };
  const mk = (n, d) => ({ n: B[n], d });
  const bars = (...bs) => bs.map(b => b.map(([n, d]) => mk(n, d)));
  const A = [[['E4', 1], ['E4', 1], ['E4', 2]], [['E4', 1], ['E4', 1], ['E4', 2]],
             [['E4', 1], ['G4', 1], ['C4', 1.5], ['D4', 0.5]], [['E4', 4]]];
  const B1 = [[['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1]], [['F4', 1], ['E4', 1], ['E4', 1], ['E4', 0.5], ['E4', 0.5]],
              [['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1]], [['D4', 2], ['G4', 2]]];
  const B2 = [B1[0], B1[1], [['G4', 1], ['G4', 1], ['F4', 1], ['D4', 1]], [['C4', 4]]];
  const MELODY = [...bars(...A), ...bars(...B1), ...bars(...A), ...bars(...B2)];
  const CHORDS = ['C', 'C', 'C', 'C', 'F', 'C', 'G', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C'];
  const ROOT = { C: 48, F: 53, G: 55 };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  const SONGS = {
    calm:  { bpm: 116, vol: 0.5, lead: 'triangle', leadV: 0.1, bass: 'sine', drums: false },
    fight: { bpm: 144, vol: 0.62, lead: 'square', leadV: 0.055, bass: 'sawtooth', drums: true },
  };
  let song = null, timer = null, musicBus = null;

  function schedule(def, startBeat, endBeat, t0, spb) {
    // 把 [startBeat, endBeat) 範圍內的音符排進 WebAudio 時鐘
    MELODY.forEach((bar, bi) => {
      let bb = bi * 4;
      for (const nt of bar) {
        if (bb >= startBeat && bb < endBeat) {
          const d = (t0 + bb * spb) - ac.currentTime;
          tone(hz(nt.n + 12), nt.d * spb * 0.9, def.lead, def.leadV, 0, d, musicBus);
          if (def.lead === 'triangle') tone(hz(nt.n), nt.d * spb * 0.9, 'sine', 0.05, 0, d, musicBus);
        }
        bb += nt.d;
      }
    });
    for (let bt = Math.ceil(startBeat * 2) / 2; bt < endBeat; bt += 0.5) {
      const d = (t0 + bt * spb) - ac.currentTime, bar = Math.floor(bt / 4) % 16, inBar = bt % 4;
      const root = ROOT[CHORDS[bar]];
      if (def.drums) {
        if (Number.isInteger(bt)) tone(150, 0.16, 'sine', 0.55, 40, d, musicBus);                      // 底鼓:每拍
        if (inBar === 1 || inBar === 3) noise(0.1, 0.22, 1800, 'bandpass', d, 900, musicBus);           // 小鼓:2、4 拍
        tone(hz(root), 0.2, def.bass, 0.08, 0, d, musicBus);                                            // 八分音符低音
        if (!Number.isInteger(bt)) noise(0.05, 0.1, 7000, 'highpass', d, 0, musicBus);                  // 反拍鈴聲
      } else {
        if (inBar === 0 || inBar === 2) tone(hz(root + (inBar === 2 ? 7 : 0)), 0.45, def.bass, 0.16, 0, d, musicBus);
        if (!Number.isInteger(bt) || inBar === 0) noise(0.07, 0.05, 7500, 'highpass', d, 0, musicBus); // 雪橇鈴
      }
    }
  }

  function pump() {
    if (!song || !ac) return;
    const spb = 60 / song.def.bpm, loopBeats = 64;
    const horizon = (ac.currentTime + 0.35 - song.t0) / spb;       // 排到 0.35 秒之後
    while (song.done < horizon) {
      const from = song.done, base = Math.floor(from / loopBeats) * loopBeats;
      const end = Math.min(horizon, base + loopBeats);
      schedule(song.def, from - base, end - base, song.t0 + base * spb, spb);
      song.done = end;
    }
  }

  function startSong(name) {
    if (!ac || (song && song.name === name)) return;
    stopSong();
    const def = SONGS[name];
    musicBus = ac.createGain(); musicBus.gain.value = def.vol; musicBus.connect(master);
    song = { name, def, t0: ac.currentTime + 0.1, done: 0 };
    pump(); timer = setInterval(pump, 60);
  }
  function stopSong() {
    if (timer) clearInterval(timer);
    timer = null;
    if (musicBus && ac) {
      const bus = musicBus, t = ac.currentTime;
      bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 0.25);
      setTimeout(() => { try { bus.disconnect(); } catch (e) {} }, 400);
    }
    song = null; musicBus = null;
  }

  return {
    init,
    music: startSong,
    stopMusic: stopSong,
    // 目前歌曲的拍數(含小數);沒有音樂時回傳 null,呼叫端要自己備援
    beat() { return song && ac ? (ac.currentTime - song.t0) / (60 / song.def.bpm) : null; },
    bpm() { return song ? song.def.bpm : 0; },
    setPaused(p) { if (!ac) return; if (p) ac.suspend(); else ac.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      try { localStorage.setItem('cog_muted', muted ? '1' : '0'); } catch (e) {}
    },
    tick()    { tone(1320, 0.05, 'square', 0.06, 0); },
    click()   { tone(520, 0.08, 'square', 0.12, 780); },
    swap()    { tone(400, 0.06, 'square', 0.1, 600); tone(600, 0.06, 'square', 0.1, 900, 0.05); },
    throw()   { noise(0.16, 0.18, 800, 'highpass', 0, 3500); tone(300, 0.12, 'triangle', 0.1, 700); },
    giftHit() { tone(660, 0.12, 'triangle', 0.3, 990); tone(990, 0.2, 'triangle', 0.25, 1320, 0.07); tone(1320, 0.25, 'sine', 0.15, 1760, 0.14); },
    coalHit() { tone(160, 0.2, 'square', 0.3, 50); noise(0.18, 0.4, 500, 'lowpass', 0, 120); tone(520, 0.1, 'sawtooth', 0.12, 260, 0.04); },
    wrong()   { tone(280, 0.28, 'sawtooth', 0.25, 110); tone(240, 0.28, 'square', 0.12, 90, 0.05); },
    cry()     { for (let i = 0; i < 3; i++) tone(820, 0.16, 'sine', 0.14, 520, i * 0.16); },
    laugh()   { for (let i = 0; i < 4; i++) tone(330 + (i % 2) * 40, 0.09, 'square', 0.1, 260, i * 0.1); },
    miss()    { tone(330, 0.18, 'triangle', 0.25, 220); tone(220, 0.35, 'triangle', 0.25, 120, 0.15); },
    heart()   { tone(200, 0.5, 'sawtooth', 0.3, 60); noise(0.4, 0.35, 400, 'lowpass', 0, 80); },
    splash()  { noise(0.12, 0.12, 2500, 'highpass', 0, 900); },
    combo()   { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.12, 0, i * 0.06)); },
    hoho()    { for (let i = 0; i < 3; i++) { tone(150, 0.17, 'triangle', 0.38, 100, i * 0.21); tone(300, 0.15, 'sine', 0.1, 200, i * 0.21); } },
    yetiRoar(){ noise(1.1, 0.5, 420, 'lowpass', 0, 90); tone(90, 1.0, 'sawtooth', 0.35, 45); tone(95, 1.0, 'square', 0.18, 50, 0.05); },
    yetiHit() { tone(110, 0.14, 'square', 0.3, 55); noise(0.12, 0.35, 700, 'lowpass', 0, 150); },
    burp()    { tone(140, 0.4, 'sawtooth', 0.3, 70); tone(100, 0.4, 'square', 0.15, 55, 0.05); },
    slam()    { noise(0.5, 0.6, 300, 'lowpass', 0, 60); tone(70, 0.5, 'sine', 0.5, 30); },
    rip()     { noise(0.55, 0.5, 6000, 'highpass', 0, 600); noise(0.3, 0.4, 1800, 'bandpass', 0.05, 300); tone(90, 0.35, 'sawtooth', 0.3, 40); tone(220, 0.2, 'square', 0.15, 80, 0.1); },
    win()     { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, 0, i * 0.09)); },
    gameover(){ [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.3, f * 0.9, i * 0.3)); },
  };
})();
