// Original chiptune + SFX synthesized live with WebAudio. Every melody here was composed for this game.
let ctx = null, master, music, sfxG, timer = null, cur = null, step = 0, nextT = 0, muted = false, noiseBuf = null;
const NI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (n) => { const m = /^([A-G])(#?)(\d)$/.exec(n || ''); return m ? 440 * 2 ** ((NI[m[1]] + (m[2] ? 1 : 0) + (m[3] - 4) * 12 - 9) / 12) : 0; };
const S = (s) => s.trim().split(/\s+/);
const TRACKS = {
  title: { bpm: 112, d: 'k.h.s.h.k.h.s.hh', lead: S('E5 - G5 A5 - G5 E5 D5 C5 - D5 E5 G5 - - - A5 - G5 E5 - D5 C5 D5 E5 - - - - - - - E5 - G5 A5 - C6 B5 A5 G5 - A5 G5 E5 - D5 - C5 D5 E5 G5 - E5 D5 - C5 - - - - - - -'),
    bass: S('C3 - C3 - G2 - G2 - A2 - A2 - E2 - E2 - F2 - F2 - C3 - C3 - G2 - G2 - G2 - B2 - C3 - C3 - G2 - G2 - A2 - A2 - E2 - E2 - F2 - F2 - G2 - G2 - C3 - G2 - C3 - - -') },
  village: { bpm: 100, d: 'k...h...s...h...', lead: S('G4 - B4 D5 - B4 C5 - A4 - - - G4 A4 B4 - D5 - E5 D5 B4 - G4 - A4 - - - - - - - B4 - D5 G5 - E5 D5 - C5 - B4 A4 G4 - A4 B4 G4 - - - - - E4 F#4 G4 - - - - - - -'),
    bass: S('G2 - - D3 G2 - - D3 C3 - - G2 C3 - - G2 E2 - - B2 E2 - - B2 D3 - - A2 D3 - - D3 G2 - - D3 G2 - - D3 C3 - - G2 A2 - - E2 G2 - - D3 D3 - - D2 G2 - - - G2 - - -') },
  forest: { bpm: 92, d: 'k..hk.s.k..hk.sh', lead: S('A4 - C5 - E5 - D5 C5 B4 - G4 - A4 - - - E4 - A4 B4 C5 - B4 A4 G#4 - - - - - - - A4 - C5 - E5 - F5 E5 D5 - C5 B4 C5 - A4 - B4 - G#4 - E4 - G#4 B4 A4 - - - - - - -'),
    bass: S('A2 - E3 - A2 - E3 - G2 - D3 - G2 - D3 - F2 - C3 - F2 - C3 - E2 - B2 - E2 - G#2 - A2 - E3 - A2 - E3 - D3 - A2 - D3 - A2 - E2 - B2 - E2 - B2 - A2 - E3 - A2 - - -') },
  mountain: { bpm: 120, d: 'k.hsk.hsk.hsk.ss', lead: S('D5 - D5 F5 - D5 C5 - A4 - C5 D5 - - - - F5 - G5 A5 - G5 F5 - E5 - C5 D5 - - - - D5 - D5 F5 - A5 G5 - F5 - E5 F5 G5 - E5 - D5 - C5 A4 - C5 D5 - - - - - - - - -'),
    bass: S('D2 D3 D2 D3 D2 D3 D2 D3 A#1 A#2 A#1 A#2 C2 C3 C2 C3 D2 D3 D2 D3 F2 F3 F2 F3 A#1 A#2 A#1 A#2 A1 A2 A1 A2') },
  boss: { bpm: 150, d: 'kshskshskshskssk', lead: S('E5 E5 - D#5 E5 - B4 - C5 - B4 A4 B4 - - - E5 E5 - D#5 E5 - G5 - F#5 - E5 D#5 E5 - - - A5 - G5 - F#5 - E5 - D#5 - B4 - C5 D#5 E5 - G5 - F#5 - E5 - D#5 - B4 - E5 - - - E4 - - -'),
    bass: S('E2 E2 E3 E2 E2 E3 E2 E3 C2 C2 C3 C2 B1 B1 B2 B1 E2 E2 E3 E2 E2 E3 E2 E3 C2 C2 C3 C2 B1 B1 B2 B1 A1 A1 A2 A1 A1 A2 A1 A2 C2 C2 C3 C2 C2 C3 C2 C3 B1 B1 B2 B1 B1 B2 B1 B2 E2 E2 E3 E2 E2 E3 E2 E3') },
  wish: { bpm: 80, d: '................', lead: S('C5 E5 G5 C6 B5 G5 E5 G5 A5 - F5 - C5 - - - D5 F5 A5 D6 C6 A5 F5 A5 G5 - E5 - G5 - - -'),
    bass: S('C3 - - - G2 - - - F2 - - - C3 - - - D3 - - - A2 - - - G2 - - - C3 - - -') },
};
function tone(type, f, t, dur, vol, dest, slide) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(t, dur, vol, freq, dest) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur);
}
function tick() {
  if (!cur || !ctx) return; const tr = TRACKS[cur], spb = 30 / tr.bpm;
  while (nextT < ctx.currentTime + 0.15) {
    const l = hz(tr.lead[step % tr.lead.length]), b = hz(tr.bass[step % tr.bass.length]), d = tr.d[step % tr.d.length];
    if (l) tone('square', l, nextT, spb * 1.6, 0.11, music); if (b) tone('triangle', b, nextT, spb * 1.8, 0.3, music);
    if (d === 'k') tone('sine', 140, nextT, 0.12, 0.7, music, 40); else if (d === 's') hiss(nextT, 0.12, 0.3, 1500, music); else if (d === 'h') hiss(nextT, 0.04, 0.12, 6000, music);
    step++; nextT += spb;
  }
}
const SFX = {
  hit: (t) => tone('square', 520, t, 0.08, 0.3, sfxG, 180), hit3: (t) => tone('square', 300, t, 0.18, 0.4, sfxG, 60), swing: (t) => hiss(t, 0.07, 0.25, 2500, sfxG),
  blast: (t) => { tone('triangle', 520, t, 0.22, 0.25, sfxG, 780); tone('triangle', 780, t + 0.05, 0.18, 0.12, sfxG, 1040); }, // short yip-howl charge: (t) => hiss(t, 0.25, 0.05, 900, sfxG), // resting: soft breath
  dash: (t) => tone('triangle', 300, t, 0.12, 0.3, sfxG, 900), hurt: (t) => tone('square', 220, t, 0.2, 0.35, sfxG, 70),
  ascend: (t) => [0, 1, 2, 3, 4].forEach((i) => tone('square', 330 * 1.26 ** i, t + i * 0.08, 0.25, 0.2, sfxG)),
  level: (t) => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, t + i * 0.09, 0.2, 0.2, sfxG)),
  pickup: (t) => { tone('square', 880, t, 0.07, 0.2, sfxG); tone('square', 1320, t + 0.07, 0.12, 0.2, sfxG); },
  orb: (t) => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone('triangle', f, t + i * 0.07, 0.3, 0.25, sfxG)),
  blip: (t) => tone('square', 1400, t, 0.025, 0.05, sfxG), select: (t) => tone('square', 660, t, 0.06, 0.2, sfxG), die: (t) => tone('sawtooth', 400, t, 0.4, 0.3, sfxG, 50),
  roar: (t) => { // Unleash: a dog's howl (sine glide up, hold with vibrato, fall off) + soft chime. Key 'roar' kept.
    const o = ctx.createOscillator(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.35); o.frequency.setValueAtTime(620, t + 0.8); o.frequency.exponentialRampToValueAtTime(420, t + 1.2);
    v.frequency.value = 6; vg.gain.value = 12; v.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.2); g.gain.setValueAtTime(0.22, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    o.connect(g); g.connect(sfxG); o.start(t); v.start(t); o.stop(t + 1.3); v.stop(t + 1.3);
    [1047, 1319, 1568].forEach((f, i) => tone('sine', f, t + 1.0 + i * 0.06, 0.4, 0.08, sfxG)); },
  croak: (t) => { tone('sawtooth', 110, t, 0.25, 0.4, sfxG, 70); tone('sawtooth', 90, t + 0.3, 0.35, 0.4, sfxG, 60); }, meow: (t) => tone('sawtooth', 500, t, 0.35, 0.3, sfxG, 1100),
};
export const Audio8 = {
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.35; music.connect(master); sfxG = ctx.createGain(); sfxG.gain.value = 0.6; sfxG.connect(master);
    nextT = ctx.currentTime + 0.05; timer = setInterval(tick, 40);
  },
  music(name) { if (cur === name) return; cur = name; step = 0; if (ctx) nextT = ctx.currentTime + 0.05; },
  sfx(name) { if (ctx && !muted && SFX[name]) try { SFX[name](ctx.currentTime); } catch {} },
  toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
  get current() { return cur; }, get running() { return !!ctx && ctx.state === 'running'; },
};
