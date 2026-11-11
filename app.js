/* Revmix — music that follows the car.
   Speed (GPS) brings layers in, acceleration adds a riser and busier hats,
   braking closes a filter and thins the drums, turning pans and adds echo. */

const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ---------- Tracks ---------- */
// prog: one chord per bar, r = semitones from root, iv = chord tones.
// Patterns are 16 steps per bar. lead = semitones above root (null = rest).
const TRACKS = {
  night: {
    name: 'Night Drive', bpm: 104, swing: 0, root: 45,
    prog: [{ r: 0, iv: [0, 3, 7, 10] }, { r: -4, iv: [0, 4, 7, 11] }, { r: 3, iv: [0, 4, 7, 14] }, { r: -2, iv: [0, 4, 7, 10] }],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'x.x.x.x.x.x.x.xx', bassWave: 'sawtooth', arpWave: 'square',
    arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2],
    lead: [12, null, null, 10, null, null, 7, null, 10, null, null, null, 15, null, 12, null],
  },
  sunday: {
    name: 'Sunday', bpm: 84, swing: 0.16, root: 48,
    prog: [{ r: 0, iv: [0, 4, 7, 11] }, { r: -3, iv: [0, 3, 7, 10] }, { r: 2, iv: [0, 3, 7, 10] }, { r: -5, iv: [0, 4, 7, 10] }],
    kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: 'x......x..x...x.', bassWave: 'triangle', arpWave: 'triangle',
    arp: [0, null, 2, null, 3, null, 1, null, 2, null, 3, null, 1, null, 2, null],
    lead: [16, null, null, null, 14, null, 12, null, null, null, 9, null, null, null, 7, null],
  },
  autobahn: {
    name: 'Autobahn', bpm: 128, swing: 0, root: 43,
    prog: [{ r: 0, iv: [0, 3, 7, 10] }, { r: -4, iv: [0, 4, 7, 11] }, { r: 3, iv: [0, 4, 7, 12] }, { r: -2, iv: [0, 4, 7, 12] }],
    kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..x...x...x...x.',
    bass: '.xxx.xxx.xxx.xxx', bassWave: 'sawtooth', arpWave: 'sawtooth',
    arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 0, 3, 2, 1],
    lead: [12, null, 12, null, null, 15, null, null, 10, null, 10, null, null, 7, null, null],
  },
};
const LAYERS = ['pad', 'bass', 'kick', 'hats', 'snare', 'arp', 'lead'];
const THRESH = { pad: -1, bass: 0.06, kick: 0.16, hats: 0.3, snare: 0.44, arp: 0.6, lead: 0.8 };
const VOL = { pad: 0.22, bass: 0.5, kick: 0.9, hats: 0.28, snare: 0.5, arp: 0.2, lead: 0.22 };
const RANGES = { city: 18, mixed: 27, highway: 36 }; // m/s at which everything is in (~40/60/80 mph)

/* ---------- Settings & state ---------- */
const settings = {
  track: store.get('rm.track', 'night'),
  range: store.get('rm.range', 'mixed'),
  units: store.get('rm.units', 'mph'),
  source: store.get('rm.source', 'drive'),
};
if (!TRACKS[settings.track]) settings.track = 'night';
if (!RANGES[settings.range]) settings.range = 'mixed';

// What the music listens to. speed in m/s, long in g (+ = accelerating), turn in deg/s (+ = right).
const input = { speed: 0, long: 0, turn: 0 };
const mix = { intensity: 0, boost: 0, brake: 0, level: Object.fromEntries(LAYERS.map((l) => [l, 0])) };
let running = false;
let statusText = 'Ready';

/* ---------- Audio ---------- */
let ctx, A; // A = audio nodes
let step = 0, nextTime = 0, schedTimer = null, ctlTimer = null;

function buildAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  // Lets Web Audio play with the iPhone silent switch on (Safari 16.4+).
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }

  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.8;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
  lp.connect(comp); comp.connect(master); master.connect(analyser); analyser.connect(ctx.destination);

  const delay = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain();
  fb.gain.value = 0.3; wet.gain.value = 0.28;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(lp);

  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  pan.connect(lp); pan.connect(delay);

  const layer = {};
  for (const name of LAYERS) {
    const g = ctx.createGain(); g.gain.value = 0;
    g.connect(name === 'arp' || name === 'lead' || name === 'hats' ? pan : lp);
    layer[name] = g;
  }

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Pad: four always-running voices, two detuned saws each, retuned on chord changes.
  const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 300; padFilter.Q.value = 1.2;
  padFilter.connect(layer.pad);
  const padOsc = [];
  for (let v = 0; v < 4; v++) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.12;
      o.connect(g); g.connect(padFilter); o.start();
      padOsc.push({ o, v });
    }
  }

  // Riser: filtered noise that swells under hard acceleration.
  const riserSrc = ctx.createBufferSource(); riserSrc.buffer = noise; riserSrc.loop = true;
  const riserBp = ctx.createBiquadFilter(); riserBp.type = 'bandpass'; riserBp.frequency.value = 800; riserBp.Q.value = 2;
  const riser = ctx.createGain(); riser.gain.value = 0;
  riserSrc.connect(riserBp); riserBp.connect(riser); riser.connect(lp); riserSrc.start();

  A = { master, lp, analyser, delay, fb, pan, layer, noise, padFilter, padOsc, riserBp, riser };
}

function setPadChord(chord, t) {
  const tr = TRACKS[settings.track];
  for (const { o, v } of A.padOsc) {
    o.frequency.setTargetAtTime(mtof(tr.root + 12 + chord.r + chord.iv[v]), t, 0.06);
  }
}

function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g); g.connect(A.layer.kick); o.start(t); o.stop(t + 0.35);
}

function noiseHit(t, out, type, freq, dur, vol) {
  const s = ctx.createBufferSource(); s.buffer = A.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

function pluck(t, out, midi, wave, dur, vol, cutoff) {
  const o = ctx.createOscillator(); o.type = wave; o.frequency.value = mtof(midi);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}

function scheduleStep(s, t) {
  const tr = TRACKS[settings.track];
  const bar = s >> 4, i = s & 15;
  const chord = tr.prog[bar % tr.prog.length];
  const L = mix.level, I = mix.intensity;
  const s16 = 60 / tr.bpm / 4;

  if (i === 0) setPadChord(chord, t);
  if (L.kick > 0.01 && tr.kick[i] === 'x') kick(t);
  if (L.snare > 0.01 && tr.snare[i] === 'x') {
    noiseHit(t, A.layer.snare, 'bandpass', 1800, 0.18, 0.9);
    pluck(t, A.layer.snare, 55, 'triangle', 0.1, 0.5, 900);
  }
  if (L.hats > 0.01) {
    const busy = mix.boost > 0.35 || I > 0.92; // 16th-note hats when pushing on
    if (tr.hat[i] === 'x') noiseHit(t, A.layer.hats, 'highpass', 7500, i % 4 === 2 ? 0.09 : 0.04, 0.8);
    else if (busy) noiseHit(t, A.layer.hats, 'highpass', 9000, 0.03, 0.4);
  }
  if (L.bass > 0.01 && tr.bass[i] === 'x') {
    pluck(t, A.layer.bass, tr.root - 12 + chord.r, tr.bassWave, s16 * 1.7, 0.9, 500 + I * 1800);
  }
  if (L.arp > 0.01 && tr.arp[i] != null) {
    pluck(t, A.layer.arp, tr.root + 24 + chord.r + chord.iv[tr.arp[i]], tr.arpWave, s16 * 1.4, 0.7, 1200 + I * 3000);
  }
  if (L.lead > 0.01 && tr.lead[i] != null && (bar & 1) === 0) {
    pluck(t, A.layer.lead, tr.root + 24 + tr.lead[i], 'sawtooth', s16 * 3.5, 0.7, 2600);
  }
}

function scheduler() {
  const tr = TRACKS[settings.track];
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05; // recover after a stall
  while (nextTime < ctx.currentTime + 0.15) {
    scheduleStep(step, nextTime);
    const s16 = 60 / tr.bpm / 4;
    nextTime += s16 * (step % 2 === 0 ? 1 + tr.swing : 1 - tr.swing);
    step = (step + 1) % 64;
  }
}

/* ---------- Sensors ---------- */
const IOS = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
const gps = { target: 0, long: 0, lastV: null, lastT: 0, lastPos: null, fixAt: 0, acc: null, denied: false };
const motion = { turn: 0, horiz: 0, seen: false, grav: null };
let geoId = null, wakeLock = null;

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function onPosition(p) {
  const c = p.coords, t = p.timestamp;
  gps.fixAt = performance.now(); gps.acc = c.accuracy; gps.denied = false;
  if (c.accuracy > 60) return; // too vague to trust
  let v = c.speed;
  if (v == null || Number.isNaN(v) || v < 0) {
    // No speed from the device: estimate from distance moved.
    v = null;
    if (gps.lastPos) {
      const dt = (t - gps.lastPos.t) / 1000, dist = haversine(gps.lastPos, c);
      if (dt > 0.3) v = dist < 3 ? 0 : dist / dt;
    }
    gps.lastPos = { latitude: c.latitude, longitude: c.longitude, t };
    if (v == null) return;
  }
  if (gps.lastV != null) {
    const dt = (t - gps.lastT) / 1000;
    if (dt > 0.2 && dt < 5) gps.long += ((v - gps.lastV) / dt / 9.81 - gps.long) * 0.5;
  }
  gps.lastV = v; gps.lastT = t; gps.target = v;
}

function onPositionError(e) {
  if (e.code === 1) gps.denied = true;
}

function onMotion(e) {
  const g = e.accelerationIncludingGravity, a = e.acceleration, r = e.rotationRate;
  if (!g || g.x == null) return;
  const hasLin = a && a.x != null;
  // Unit vector pointing up, in phone coordinates — works however the phone is mounted.
  let ux, uy, uz;
  if (hasLin) { ux = g.x - a.x; uy = g.y - a.y; uz = g.z - a.z; }
  else {
    motion.grav = motion.grav || [g.x, g.y, g.z];
    motion.grav[0] += (g.x - motion.grav[0]) * 0.05;
    motion.grav[1] += (g.y - motion.grav[1]) * 0.05;
    motion.grav[2] += (g.z - motion.grav[2]) * 0.05;
    [ux, uy, uz] = motion.grav;
  }
  const n = Math.hypot(ux, uy, uz) || 1; ux /= n; uy /= n; uz /= n;
  if (r && r.alpha != null) {
    // Rotation about the vertical axis = the car turning. iOS reports gravity with the opposite sign.
    const yawUp = (r.beta * ux + r.gamma * uy + r.alpha * uz) * (IOS ? -1 : 1);
    motion.turn += (-yawUp - motion.turn) * 0.08;
    motion.seen = true;
  }
  if (hasLin) {
    const dot = a.x * ux + a.y * uy + a.z * uz;
    const h = Math.hypot(a.x - dot * ux, a.y - dot * uy, a.z - dot * uz) / 9.81;
    motion.horiz += (h - motion.horiz) * 0.04;
  }
}

async function startSensors() {
  let motionOk = !IOS && 'DeviceMotionEvent' in window;
  if (IOS) {
    try { motionOk = (await DeviceMotionEvent.requestPermission()) === 'granted'; }
    catch { /* declined: speed still works */ }
  }
  // The permission prompt can outlast a tap on Stop or a switch to Simulate.
  if (!running || settings.source !== 'drive') return;
  if (motionOk) addEventListener('devicemotion', onMotion);
  if (geoId != null) return;
  if ('geolocation' in navigator) {
    geoId = navigator.geolocation.watchPosition(onPosition, onPositionError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  } else gps.denied = true;
}

function stopSensors() {
  removeEventListener('devicemotion', onMotion);
  if (geoId != null) navigator.geolocation.clearWatch(geoId);
  geoId = null;
  Object.assign(gps, { target: 0, long: 0, lastV: null, lastPos: null, fixAt: 0, acc: null });
  Object.assign(motion, { turn: 0, horiz: 0, seen: false, grav: null });
}

async function holdWake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
  catch { /* not allowed right now */ }
}

/* ---------- Simulator ---------- */
const sim = { gas: false, brake: false, steer: 0, v: 0 };

function simStep(dt) {
  let a;
  if (sim.brake) a = -6.5;
  else if (sim.gas) a = 3.4 * (1 - sim.v / 45);
  else a = -0.25 - 0.012 * sim.v;
  const before = sim.v;
  sim.v = Math.max(0, sim.v + a * dt);
  const real = (sim.v - before) / dt / 9.81;
  input.speed = sim.v;
  input.long += (real - input.long) * 0.3;
  input.turn = sim.v > 1 ? sim.steer * 28 : 0;
}

function driveStep(dt) {
  input.speed += (gps.target - input.speed) * Math.min(1, dt * 2.5);
  if (input.speed < 0.3 && gps.target === 0) input.speed = 0;
  let turn = Math.abs(motion.turn) > 1.5 && input.speed > 1 ? motion.turn : 0;
  // The accelerometer reacts faster than GPS; GPS says whether it is speeding up or slowing down.
  const lat = (input.speed * turn * Math.PI / 180) / 9.81;
  const fwd = Math.sqrt(Math.max(0, motion.horiz ** 2 - lat ** 2));
  let long = gps.long;
  if (Math.abs(long) > 0.03) long = Math.sign(long) * Math.max(Math.abs(long), Math.min(fwd, 0.6));
  if (performance.now() - gps.fixAt > 4000) long = 0;
  input.long += (long - input.long) * Math.min(1, dt * 4);
  input.turn = turn;
}

/* ---------- Mixing: inputs -> sound ---------- */
function control() {
  const dt = 0.05;
  if (settings.source === 'sim') simStep(dt); else driveStep(dt);

  const sp = clamp(input.speed / RANGES[settings.range]);
  const boost = clamp(input.long / 0.25), brake = clamp(-input.long / 0.3);
  const I = input.speed < 0.4 ? 0 : clamp(Math.pow(sp, 0.75) + boost * 0.25 - brake * 0.15);
  mix.intensity = I; mix.boost = boost; mix.brake = brake;

  const t = ctx.currentTime;
  for (const name of LAYERS) {
    let lv = clamp((I - THRESH[name]) / 0.08);
    if (name === 'kick' || name === 'hats' || name === 'snare') lv *= 1 - brake * 0.85; // drums thin out under braking
    mix.level[name] = lv;
    A.layer[name].gain.setTargetAtTime(lv * VOL[name], t, 0.18);
  }
  A.padFilter.frequency.setTargetAtTime(280 + 3200 * I, t, 0.3);
  A.lp.frequency.setTargetAtTime(18000 * Math.pow(0.03, brake), t, 0.12); // braking closes the filter
  A.riser.gain.setTargetAtTime(boost * boost * 0.16, t, 0.15);
  A.riserBp.frequency.setTargetAtTime(700 + 5500 * boost, t, 0.25);
  const turnN = clamp(input.turn / 25, -1, 1);
  if (A.pan.pan) A.pan.pan.setTargetAtTime(turnN * 0.8, t, 0.2);
  A.fb.gain.setTargetAtTime(0.28 + 0.4 * Math.abs(turnN), t, 0.2);

  if (settings.source === 'sim') statusText = 'Simulating';
  else if (gps.denied) statusText = 'Location is off — allow it to read speed';
  else if (!gps.fixAt) statusText = 'Waiting for GPS…';
  else if (performance.now() - gps.fixAt > 6000) statusText = 'GPS signal lost';
  else statusText = `GPS ±${Math.round(gps.acc)} m${motion.seen ? '' : ' · no motion sensor'}`;
}

/* ---------- Start / stop ---------- */
async function start() {
  if (running) return;
  if (!ctx) buildAudio();
  ctx.resume(); // must happen inside the tap
  running = true;
  applyTrack();
  step = 0; nextTime = ctx.currentTime + 0.1;
  A.master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.4);
  schedTimer = setInterval(scheduler, 25);
  ctlTimer = setInterval(control, 50);
  render();
  holdWake();
  if (settings.source === 'drive') await startSensors();
}

function stop() {
  if (!running) return;
  running = false;
  clearInterval(schedTimer); clearInterval(ctlTimer);
  A.master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  setTimeout(() => { if (!running) ctx.suspend(); }, 500);
  stopSensors();
  Object.assign(sim, { gas: false, brake: false, v: 0 });
  Object.assign(input, { speed: 0, long: 0, turn: 0 });
  mix.intensity = 0; for (const l of LAYERS) mix.level[l] = 0;
  if (wakeLock) wakeLock.release().catch(() => {});
  statusText = 'Ready';
  render();
}

function applyTrack() {
  if (!ctx) return;
  const tr = TRACKS[settings.track];
  A.delay.delayTime.setTargetAtTime((60 / tr.bpm) * 0.75, ctx.currentTime, 0.05);
  setPadChord(tr.prog[(step >> 4) % tr.prog.length], ctx.currentTime);
}

async function setSource(src) {
  settings.source = src; store.set('rm.source', src);
  if (running) {
    stopSensors(); sim.v = input.speed;
    if (src === 'drive') await startSensors();
  }
}

/* ---------- UI ---------- */
const ARC = 2 * Math.PI * 120 * 0.75;
const pills = {};
let frameQueued = false;

function buildUI() {
  const row = $('#layers');
  for (const name of LAYERS) {
    const el = document.createElement('span'); el.className = 'pill'; el.textContent = name;
    row.appendChild(el); pills[name] = el;
  }
  const sel = $('#track');
  for (const [id, t] of Object.entries(TRACKS)) sel.add(new Option(`${t.name} · ${t.bpm} bpm`, id));
  sel.value = settings.track;
  sel.onchange = () => { settings.track = sel.value; store.set('rm.track', sel.value); applyTrack(); };

  for (const seg of document.querySelectorAll('.seg')) {
    const key = seg.dataset.key;
    const mark = () => { for (const b of seg.children) b.setAttribute('aria-pressed', b.dataset.v === settings[key]); };
    for (const b of seg.children) {
      b.onclick = () => {
        if (key === 'source') setSource(b.dataset.v);
        else { settings[key] = b.dataset.v; store.set('rm.' + key, b.dataset.v); }
        mark(); render();
      };
    }
    mark();
  }

  $('#go').onclick = () => (running ? stop() : start());

  const hold = (el, prop) => {
    const on = (e) => { e.preventDefault(); sim[prop] = true; el.classList.add('held'); };
    const off = () => { sim[prop] = false; el.classList.remove('held'); };
    el.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
  };
  hold($('#gas'), 'gas'); hold($('#brake'), 'brake');
  const steer = $('#steer');
  steer.oninput = () => { sim.steer = +steer.value; };
  const center = () => { steer.value = 0; sim.steer = 0; };
  steer.addEventListener('pointerup', center); steer.addEventListener('pointercancel', center);

  const keys = { ArrowUp: ['gas', true], ArrowDown: ['brake', true], ArrowLeft: ['steer', -1], ArrowRight: ['steer', 1] };
  addEventListener('keydown', (e) => { const k = keys[e.key]; if (k && settings.source === 'sim') { sim[k[0]] = k[1]; e.preventDefault(); } });
  addEventListener('keyup', (e) => { const k = keys[e.key]; if (k) sim[k[0]] = k[0] === 'steer' ? 0 : false; });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running) { holdWake(); ctx.resume(); }
  });
}

function render() {
  const kmh = settings.units === 'kmh';
  $('#speed').textContent = Math.round(input.speed * (kmh ? 3.6 : 2.23694));
  $('#unit').textContent = kmh ? 'km/h' : 'mph';
  $('#arc').style.strokeDashoffset = ARC * (1 - mix.intensity);
  for (const name of LAYERS) pills[name].style.setProperty('--on', mix.level[name].toFixed(2));
  $('#dot').style.transform = `translate(${clamp(input.turn / 25, -1, 1) * 30}px, ${clamp(-input.long / 0.4, -1, 1) * 30}px)`;
  $('#status').textContent = statusText;
  $('#go').textContent = running ? 'Stop' : 'Start';
  $('#go').classList.toggle('on', running);
  $('#sim').hidden = settings.source !== 'sim';
  document.body.classList.toggle('braking', mix.brake > 0.3);
  if (running && !frameQueued) {
    frameQueued = true;
    requestAnimationFrame(() => { frameQueued = false; render(); });
  }
}

buildUI();
render();
window.revmix = { input, mix, settings, get audio() { return A; }, get ctx() { return ctx; } }; // handy for debugging

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
