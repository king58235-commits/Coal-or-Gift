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

  function tone(f, d, type, v, slide, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
    g.gain.setValueAtTime(v == null ? 0.25 : v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + d + 0.03);
  }

  let noiseBuf = null;
  function noise(d, v, freq, type, delay, sweep) {
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
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + d + 0.03);
  }

  return {
    init,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      try { localStorage.setItem('cog_muted', muted ? '1' : '0'); } catch (e) {}
    },
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
