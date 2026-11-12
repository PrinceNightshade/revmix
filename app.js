/* Revmix — music that follows the car.
   Speed brings the band in (all of it by 25 mph), a faster "highway" zone switches to a
   busier groove, hard acceleration kicks that groove in early with a crash, braking closes
   a filter, turning pans, and each compass direction has its own chord sequence. */

const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ---------- Harmony ---------- */
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
// A chord is written as a scale degree (1-7). It gets a seventh on top by default;
// "n" puts a ninth on top and "o" an octave. Result: r = semitones from the key note, and the chord tones
// in three flavours: rich (as written), simple (plain three-note chord, doubled at the octave) and
// open (no middle note at all: root, fifth, octave, fifth).
function chord(scale, tok) {
  const d = parseInt(tok, 10) - 1;
  const top = tok.endsWith('n') ? 8 : tok.endsWith('o') ? 7 : 6;
  const note = (k) => scale[k % 7] + 12 * Math.floor(k / 7);
  let r = note(d);
  const iv = [0, 2, 4, top].map((k) => note(d + k) - r);
  if (r > 5) r -= 12; // keep roots near the key note so the bass stays in register
  return { rich: { r, iv }, simple: { r, iv: [iv[0], iv[1], iv[2], 12] }, open: { r, iv: [0, iv[2], 12, iv[2] + 12] } };
}

/* ---------- Tracks ---------- */
// dirs / hwDirs: an 8-bar chord sequence for each compass direction, for the street and highway sections.
// street / hw: 16-step drum and bass patterns for the two speed zones. Hats (x = closed, o = open) are shared.
// arp = which chord tone to play; lead = semitones above the key note (null = rest).
// More melodies and arp patterns are derived from these below, so each track has several to rotate through.
// kit: the track's own drum sounds, pad tone, instrument tones and amount of echo.
// Besides the plain synth tones there are recorded instruments: 'choir' (pad), 'voice', 'mallet', 'piano', 'harp', 'celeste' and 'strings'.
// choir / strings: how much of the recorded choir and string section plays along with the pad on the street
// and on the highway. hwLead: the instrument that doubles the melody on the highway.
// Pachelbel's Canon, written as semitones above the key note, one entry per chord of its eight-chord loop.
// a = the famous slow descending tune, b = the second voice that joins under it, fig = the running figure.
const CANON = {
  chords: '1 5 6 3 4 1 4 5',
  a: [4, 2, 0, -1, -3, -5, -3, -1],
  b: [0, -1, -3, -5, -7, -8, -7, -10],
  fig: [[0, 4, 7, 5], [4, 0, 4, 2], [0, -3, 0, 7], [5, 9, 7, 5], [4, 0, 2, 11], [12, 16, 19, 7], [9, 5, 7, 4], [0, 12, 12, 11]],
};

const TRACKS = {
  neon: { // slower and moodier
    name: 'Neon Coast', bpm: 96, swing: 0, root: 42, scale: 'minor',
    vibe: 'Dreamy and slow',
    kit: { kickHz: 110, kickTail: 0.45, snareHz: 2600, snareDur: 0.3, hatHz: 6000, pad: 'triangle', waves: ['triangle', 'sine'], echo: 0.42, choir: { street: 0.4, hw: 0.6 }, strings: { hw: 0.5 }, hwLead: 'celeste' },
    dirs: { N: '1 7o 6 7n 1 7o 6 5', E: '6 3 7 1 6 3 4 5', S: '1 1n 4 4 6 6 7 7o', W: '4 1 6 7 4 1 3 7n' },
    hwDirs: { N: '6 7 1 3 6 7 1 1n', E: '3 7 4 1 3 7 6 5', S: '1 6 4 5 1 6 7 7o', W: '4 5 6 3 4 5 7 1' },
    street: { kick: 'x.........x.....', snare: '........x.......', hat: '..o...o...o..xx.', bass: 'x..x..x.x..x..x.' }, // half-time: the beat feels half as fast
    hw: { kick: 'x.....x...x.....', snare: '........x.....x.', bass: 'x.x.x.x.x.x.x.x.' },
    bassWave: 'sawtooth', arpWave: 'sawtooth',
    arp: [0, 1, 2, 3, null, 2, 1, 2, 0, 1, 2, 3, null, 3, 2, 1],
    lead: [null, null, 12, null, 15, null, 12, null, 10, null, null, 7, null, null, 10, null],
  },
  night: {
    name: 'Night Drive', bpm: 104, swing: 0, root: 45, scale: 'minor',
    vibe: 'Synthwave',
    kit: { kickHz: 150, kickTail: 0.32, snareHz: 1800, snareDur: 0.18, hatHz: 7500, pad: 'sawtooth', waves: ['sawtooth', 'square'], echo: 0.28, choir: { hw: 0.35 }, strings: { hw: 0.5 }, hwLead: 'strings' },
    dirs: { N: '1 6 3n 7 1 6 4 5', E: '6 7 1 1n 6 7 3 5', S: '1 4 6 5 1 4 7o 3', W: '4 6 1 7 4 6 3n 7' },
    hwDirs: { N: '3 7 1 6 3 7 4 5', E: '6 3 7 1 6 3 4 7o', S: '1 7 6 7 1 7 6 5', W: '4 5 6 7o 4 5 3 3n' },
    street: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..o...o...o...o.', bass: 'x.x.x.x.x.x.x.xx' },
    hw: { kick: 'x...x...x...x.x.', snare: '....x.......x...', bass: 'x.x.x.x.x.x.x.x.' },
    bassWave: 'sawtooth', arpWave: 'square',
    arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2],
    lead: [12, null, null, 10, null, null, 7, null, 10, null, null, null, 15, null, 12, null],
  },
  sunday: {
    name: 'Sunday', bpm: 84, swing: 0.16, root: 48, scale: 'major',
    vibe: 'Laid-back lo-fi',
    kit: { kickHz: 120, kickTail: 0.25, snareHz: 1300, snareDur: 0.12, hatHz: 5000, pad: 'triangle', waves: ['piano', 'harp'], echo: 0.2, strings: { hw: 0.45 }, hwLead: 'harp' },
    dirs: { N: '1 6 2 5 3 6 2 5', E: '4 5 3 6 4 5 1 1n', S: '6 4 1 5 6 4 2 5', W: '2 5 1 6 2 5 1n 4' },
    hwDirs: { N: '4 3 2 1 4 3 2 5', E: '1 3 4 5 1 3 4 2', S: '6 5 4 5 6 5 4 1', W: '2 3 4 5 6 5 4 5' },
    street: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x......x..x...x.' },
    hw: { kick: 'x..x...x..x..x..', snare: '....x..x....x...', bass: 'x.x.x.x.x.x.x.x.' },
    bassWave: 'triangle', arpWave: 'triangle',
    arp: [0, null, 2, null, 3, null, 1, null, 2, null, 3, null, 1, null, 2, null],
    lead: [16, null, null, null, 14, null, 12, null, null, null, 9, null, null, null, 7, null],
  },
  cathedral: { // a choir singing Pachelbel's Canon in D: one eight-chord loop, with the tune and its variations on top
    name: 'Cathedral', bpm: 88, swing: 0, root: 50, scale: 'major', canon: true,
    vibe: 'Pachelbel\u2019s Canon, sung',
    kit: { kickHz: 95, kickTail: 0.5, snareHz: 1500, snareDur: 0.35, hatHz: 4500, pad: 'choir', waves: ['strings', 'harp', 'voice'], echo: 0.3, room: 0.7, stab: 'voice', strings: { hw: 0.5 } },
    dirs: { N: CANON.chords, E: CANON.chords, S: CANON.chords, W: CANON.chords },
    hwDirs: { N: CANON.chords, E: CANON.chords, S: CANON.chords, W: CANON.chords },
    street: { kick: 'x.......x.....x.', snare: '........x.......', hat: '....x.......x...', bass: 'x.......x.......' },
    hw: { kick: 'x...x...x...x...', snare: '....x.......x...', bass: 'x.x.x.x.x.x.x.x.' },
    bassWave: 'triangle', arpWave: 'triangle',
    arp: [0, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null, 2, null],
    lead: [4, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null],
  },
  daybreak: { // wood and skin instead of synths: mallets, shaker and hand drums
    name: 'Daybreak', bpm: 100, swing: 0.08, root: 46, scale: 'major',
    vibe: 'Mallets and hand drums',
    kit: { kickHz: 105, kickTail: 0.28, snareHz: 1200, snareDur: 0.05, hatHz: 6500, pad: 'triangle', waves: ['mallet', 'triangle'], echo: 0.3, stab: 'mallet', handHz: 200, shaker: true, choir: { hw: 0.45 }, strings: { hw: 0.4 } },
    dirs: { N: '1 4 6 5 1 4 2 5', E: '6 4 1 5 6 4 1 1n', S: '4 1 5 6 4 1 2 5', W: '1 3 4 5 6 5 4 5' },
    hwDirs: { N: '4 5 6 1 4 5 2 5', E: '1 5 6 4 1 5 4 5', S: '6 5 4 1 6 5 4 5', W: '2 5 1 6 2 5 4 5' },
    street: { kick: 'x.....x...x.....', snare: '...x..x.....x.x.', hat: 'x.xxx.xxx.xxx.xx', bass: 'x..x..x...x..x..' },
    hw: { kick: 'x...x...x...x...', snare: '...x..x..x..x.x.', bass: 'x.x.x.x.x.x.x.x.' },
    bassWave: 'triangle', arpWave: 'mallet',
    arp: [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2],
    lead: [16, null, 12, null, null, 9, null, 7, null, null, 9, null, 12, null, null, null],
  },
};
const DIRS = ['N', 'E', 'S', 'W'];
const PENT = { minor: [0, 3, 5, 7, 10], major: [0, 2, 4, 7, 9] }; // five-note scales that sit well over every chord
const RHYTHMS = ['x..x..x.x...x.x.', 'x.....x.x..x....', '..x.x..x..x...x.', 'x..x....x..x..x.', 'x.x...x...x.x...', '....x.x.x.....x.'];

// Writes a one-bar melody: picks a rhythm, then walks up and down the five-note scale in small steps
// and lands on a restful note. The same seed always gives the same melody.
function seeded(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

function makePhrase(pent, seed, high) {
  const rnd = seeded(seed);
  const ladder = [...pent, ...pent.map((n) => n + 12), 24];
  const lo = high ? 4 : 2, hi = high ? 8 : 7;
  const rhythm = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)];
  let pos = lo + 1 + Math.floor(rnd() * 3), last = -1;
  const out = [];
  for (let i = 0; i < 16; i++) {
    if (rhythm[i] !== 'x') { out.push(null); continue; }
    out.push(ladder[pos]); last = i;
    const r = rnd();
    pos = clamp(pos + (r < 0.4 ? -1 : r < 0.8 ? 1 : r < 0.9 ? -2 : 2), lo, hi);
  }
  const rest = ladder.filter((n, k) => k >= lo && k <= hi && (n % 12 === 0 || n % 12 === 7));
  out[last] = rest.reduce((a, b) => (Math.abs(b - out[last]) < Math.abs(a - out[last]) ? b : a));
  return out;
}

for (const [id, tr] of Object.entries(TRACKS)) {
  const chords = (seqs) => Object.fromEntries(DIRS.map((d) => [d, seqs[d].split(' ').map((tok) => chord(SCALES[tr.scale], tok))]));
  tr.prog = { street: chords(tr.dirs), highway: chords(tr.hwDirs) };
  const seed = tr.seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const pent = PENT[tr.scale];
  tr.leads = {
    street: [tr.lead, ...[1, 2, 3].map((n) => makePhrase(pent, seed + n * 977, false))],
    highway: [1, 2, 3, 4].map((n) => makePhrase(pent, seed + 5000 + n * 613, true)),
  };
  tr.arps = [tr.arp, [...tr.arp].reverse(), [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3]];
}
const ROTATE = { off: 0, 3: 3, 5: 5 }; // minutes before moving to the next track

/* ---------- Chapters ---------- */
// A drive is told in chapters of 64 bars. Each chapter ends with a breakdown and a build, and the next one
// opens in a new key with new chord sequences, new melodies and different instrument tones.
// Chapter 1 is the track as written; later chapters are composed by rule from these building blocks.
const CELLS = { // four-chord movements that work in each kind of key
  minor: ['1 6 3 7', '1 7 6 7', '6 7 1 1', '1 4 6 5', '4 6 1 7', '6 3 7 1', '1 3 7 4', '3 7 1 6', '4 5 6 7', '1 6 4 5', '6 4 1 5', '1 5 6 4', '4 1 6 7', '3 4 6 7', '1 7 4 6', '6 1 3 7'],
  major: ['1 6 2 5', '4 5 3 6', '6 4 1 5', '2 5 1 6', '1 3 4 5', '4 3 2 5', '1 5 6 4', '6 5 4 5', '2 3 4 5', '1 4 6 5', '4 1 5 6', '3 6 2 5'],
};
const TURNS = { minor: ['5', '7', '7o', '3', '3n'], major: ['5', '5', '4', '2', '1n'] }; // chords that lead back to the start
const BASS_POOL = ['x.x.x.x.x.x.x.xx', 'x..x..x.x..x..x.', 'x.xxx.xxx.xxx.xx', 'x...x.x.x...x.xx', 'x.x...x.x.x...x.'];
const KEY_MOVES = [5, -2, 3, -4, 7, -5, 2]; // semitones to the next chapter's key

function makeChapter(id, n) {
  const tr = TRACKS[id];
  if (n === 0) return { n, shift: 0, prog: tr.prog, leads: tr.leads, arps: tr.arps, leadWave: tr.kit.waves[0], arpWave: tr.arpWave, bass: tr.street.bass };
  const rnd = seeded(tr.seed + n * 7919);
  const pick = (list) => list[Math.floor(rnd() * list.length)];

  // Key: walk from the home key one move per chapter, staying within half an octave of home.
  let shift = 0;
  const walk = seeded(tr.seed + 31);
  const recent = [0];
  for (let k = 0; k < n; k++) {
    const wrap = (v) => (v > 6 ? v - 12 : v < -5 ? v + 12 : v);
    const options = KEY_MOVES.map((m) => wrap(shift + m)).filter((v) => !recent.includes(v)); // don't return to a recent key
    shift = options[Math.floor(walk() * options.length)];
    recent.push(shift);
    if (recent.length > 4) recent.shift();
  }

  // The Canon keeps its chords and tunes in every chapter: only the key and the second instrument change.
  if (tr.canon) return { n, shift, prog: tr.prog, leads: tr.leads, arps: tr.arps, leadWave: pick(tr.kit.waves), arpWave: tr.arpWave, bass: tr.street.bass };

  // Chords: shuffle the movements, give each direction and zone its own, and end each 8 bars on a turnaround.
  const cells = [...CELLS[tr.scale]];
  for (let k = cells.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [cells[k], cells[j]] = [cells[j], cells[k]]; }
  const seqOf = (k) => {
    const a = cells[k % cells.length].split(' ');
    const b = rnd() < 0.5 ? [...a] : cells[(k + 8) % cells.length].split(' ');
    b[3] = pick(TURNS[tr.scale]);
    if (rnd() < 0.4) a[2] += 'n';
    return [...a, ...b].map((tok) => chord(SCALES[tr.scale], tok));
  };
  const prog = { street: {}, highway: {} };
  DIRS.forEach((d, k) => { prog.street[d] = seqOf(k); prog.highway[d] = seqOf(k + 4); });

  const pent = PENT[tr.scale];
  const leads = {
    street: [1, 2, 3, 4].map((m) => makePhrase(pent, tr.seed + n * 104729 + m * 977, false)),
    highway: [1, 2, 3, 4].map((m) => makePhrase(pent, tr.seed + n * 104729 + 5000 + m * 613, true)),
  };
  const arps = tr.arps.map((_, k) => tr.arps[(k + n) % tr.arps.length]);
  return { n, shift, prog, leads, arps, leadWave: pick(tr.kit.waves), arpWave: pick(tr.kit.waves), bass: pick(BASS_POOL) };
}
// Each compass direction has a signature sound. Their volumes follow the heading, so NE is half N, half E.
const DIR_SOUND = { N: 'glass', E: 'pluck', S: 'drone', W: 'strings' };
const DIR_VOL = { N: 0.2, E: 0.2, S: 0.26, W: 0.11 };
const E_PLUCK = 'x..x..x..x.x..x.';
const STAB = '...x..x...x..x..';

const LAYERS = ['pad', 'bass', 'kick', 'hats', 'snare', 'arp', 'lead', 'stabs'];
// Speed in mph at which each layer joins. Everything is in by 25 mph.
const JOIN = { pad: -99, bass: 3, kick: 7, hats: 11, snare: 15, arp: 19, lead: 23 };
const VOL = { pad: 0.22, bass: 0.5, kick: 0.9, hats: 0.28, snare: 0.5, arp: 0.2, lead: 0.22, stabs: 0.2 };
const HWY = { low: 15.6, mid: 20.1, high: 24.6 }; // m/s where the highway zone starts (~35/45/55 mph)
const HWY_LABEL = { mph: { low: '35', mid: '45', high: '55' }, kmh: { low: '55', mid: '70', high: '90' } };

/* ---------- Settings & state ---------- */
const settings = {
  track: store.get('rm.track', 'neon'),
  hwy: store.get('rm.hwy', 'mid'),
  units: store.get('rm.units', 'mph'),
  source: store.get('rm.source', 'drive'),
  rotate: store.get('rm.rotate', '5'),
  chords: store.get('rm.chords', 'simple'),
};
if (!['rich', 'simple', 'open'].includes(settings.chords)) settings.chords = 'simple';
if (!TRACKS[settings.track]) settings.track = 'neon';
if (!HWY[settings.hwy]) settings.hwy = 'mid';
if (!(settings.rotate in ROTATE)) settings.rotate = '5';

// What the music listens to. speed in m/s, long in g (+ = accelerating), turn in deg/s (+ = right),
// heading in degrees clockwise from north (null until known).
const input = { speed: 0, long: 0, turn: 0, heading: null };
const mix = {
  intensity: 0, boost: 0, brake: 0, surge: 0, bright: 0,
  zoneWant: 'street', dirWant: 'N',
  dirW: { N: 0, E: 0, S: 0, W: 0 }, // how much of each compass sound is in the mix
  level: Object.fromEntries(LAYERS.map((l) => [l, 0])),
};
let running = false;
let statusText = 'Ready';

/* ---------- Audio ---------- */
let ctx, A; // A = audio nodes
// Sequencer position: step 0-15 in the bar, bar 0-7 in the 8-bar pass, cycle = passes played.
// ci = which of the 8 chords is sounding; held and dist = bars and metres travelled since it arrived.
// zone and dir only change on a bar line, so switches land in time.
// bpm is fixed for the whole drive: it is set by the track you choose and kept when tracks rotate.
const seq = { step: 0, bar: 0, cycle: 0, ci: 0, held: 0, dist: 0, zone: 'street', dir: 'N', launch: false, lastLaunch: -1e9, trackStart: 0, bpm: TRACKS[settings.track].bpm };
let chap = makeChapter(settings.track, 0); // the chapter being played
let nextTime = 0, schedTimer = null, ctlTimer = null;

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

  // Room: a reverb made from two seconds of fading noise, so notes ring in a space instead of stopping dead.
  const room = ctx.createConvolver(), roomWet = ctx.createGain(); roomWet.gain.value = 0.35;
  const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.2), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let k = 0; k < data.length; k++) data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / data.length, 3.2);
  }
  room.buffer = ir; room.connect(roomWet); roomWet.connect(lp);
  pan.connect(room);

  // A rounder replacement for the bare triangle and square tones, which are what old game consoles used.
  const warm = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.42, 0.2, 0.1, 0.05, 0.025]));
  const hollow = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.12, 0.5, 0.06, 0.24, 0.03, 0.1]));

  // Pad and stabs pass through "duck", which dips on every kick for a pumping feel.
  const duck = ctx.createGain(); duck.connect(lp); duck.connect(room);
  const fx = ctx.createGain(); fx.gain.value = 0.5; fx.connect(lp); // crashes and impacts

  const layer = {};
  for (const name of LAYERS) {
    const g = ctx.createGain(); g.gain.value = 0;
    g.connect(name === 'arp' || name === 'lead' || name === 'hats' ? pan : name === 'pad' || name === 'stabs' ? duck : lp);
    layer[name] = g;
  }

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Pad: four always-running voices, two detuned saws each, retuned on chord changes.
  const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 300; padFilter.Q.value = 1.2;
  const padDry = ctx.createGain(); padFilter.connect(padDry); padDry.connect(layer.pad);
  // Choir: the same voices sung through three resonances, the way a mouth shapes a vowel, with a slow vibrato.
  const choirIn = ctx.createGain(), choirOut = ctx.createGain(); choirOut.gain.value = 0; choirOut.connect(layer.pad);
  const formants = VOWELS[0].map((hz, k) => {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = 7;
    const g = ctx.createGain(); g.gain.value = [3.2, 1.8, 0.7][k];
    choirIn.connect(f); f.connect(g); g.connect(choirOut);
    return f;
  });
  const choirSung = ctx.createGain(); choirSung.connect(layer.pad);
  const vibLfo = ctx.createOscillator(); vibLfo.frequency.value = 5.1;
  const vib = ctx.createGain(); vib.gain.value = 0; vibLfo.connect(vib); vibLfo.start();
  const padOsc = [];
  for (let v = 0; v < 4; v++) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.12;
      o.connect(g); g.connect(padFilter); g.connect(choirIn); vib.connect(o.detune); o.start();
      padOsc.push({ o, v });
    }
  }

  // Compass sounds. N: bell notes into the main echo. E: short plucks into their own quick, bouncing echo.
  // S: a low drone. W: a wide wash of detuned strings. The drone and strings run all the time and are retuned per chord.
  const dirGain = {};
  for (const d of DIRS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(lp); g.connect(room); dirGain[d] = g; }
  const bellSend = ctx.createGain(); bellSend.gain.value = 0.35; // only a little echo, so bells don't ring into the next chord
  dirGain.N.connect(bellSend); bellSend.connect(delay);
  const eDelay = ctx.createDelay(1), eFb = ctx.createGain(); eFb.gain.value = 0.5;
  dirGain.E.connect(eDelay); eDelay.connect(eFb); eFb.connect(eDelay); eDelay.connect(lp);

  const droneLp = ctx.createBiquadFilter(); droneLp.type = 'lowpass'; droneLp.frequency.value = 320; droneLp.connect(dirGain.S);
  const drone = [['sine', -12, 0.5], ['sawtooth', 0, 0.3], ['sawtooth', 0.08, 0.3]].map(([type, semis, vol]) => {
    const o = ctx.createOscillator(); o.type = type;
    const g = ctx.createGain(); g.gain.value = vol;
    o.connect(g); g.connect(droneLp); o.start();
    return { o, semis };
  });

  const stringLp = ctx.createBiquadFilter(); stringLp.type = 'lowpass'; stringLp.frequency.value = 1500; stringLp.connect(dirGain.W);
  const strings = [];
  for (let v = 0; v < 3; v++) {
    for (const side of [-1, 1]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = side * 14;
      const g = ctx.createGain(); g.gain.value = 0.2;
      o.connect(g);
      if (ctx.createStereoPanner) { const sp = ctx.createStereoPanner(); sp.pan.value = side * 0.8; g.connect(sp); sp.connect(stringLp); }
      else g.connect(stringLp);
      o.start();
      strings.push({ o, v });
    }
  }

  A = { master, lp, analyser, delay, fb, wet, pan, duck, fx, layer, noise, padFilter, padOsc, padDry, choirOut, formants, vib, vibLfo, choirSung, stringLp, smp: {}, roomWet, warm, hollow, dirGain, eDelay, drone, strings };
}

// The chords move with the road, not the clock: a new chord arrives every CHORD_M metres, landing on a
// bar line. So the beat never changes, but the harmony moves slowly in town and faster on the highway.
const CHORD_M = 70;
const currentChord = () => chap.prog[seq.zone][seq.dir][seq.ci][TRACKS[settings.track].canon ? 'simple' : settings.chords];
const firstChord = () => { seq.ci = 0; seq.held = 0; seq.dist = 0; };

/* ---------- Recorded instruments ---------- */
// Real recordings of a choir and an orchestra (see sounds/README.txt). Each instrument has a few recorded
// notes; any other note is the nearest recording sped up or slowed down by a few semitones. Each instrument
// loads on its own, and until it has loaded (or if it can't) its synthetic stand-in plays.
const SOUNDS = {
  choir: [52, 56, 60, 64, 68, 72, 76, 80],
  strings: [48, 54, 58, 64, 70, 76, 82, 88],
  marimba: [48, 52, 56, 60, 64, 68, 72, 76, 80, 84],
  piano: [60, 64, 69, 72, 76, 81, 85, 90, 94, 98],
  harp: [60, 66, 72, 78, 84],
  celeste: [72, 80, 88, 96],
  timp: [36, 42, 48],
  hit: ['shaker', 'conga', 'congamute', 'cymbal', 'timproll'], // one-off sounds with no pitch to follow
};
function loadSounds() {
  for (const [inst, notes] of Object.entries(SOUNDS)) {
    Promise.all(notes.map(async (n) => {
      const data = await (await fetch('sounds/' + inst + '/' + n + '.m4a')).arrayBuffer();
      const buf = await new Promise((ok, no) => ctx.decodeAudioData(data, ok, no));
      // Skip any silence at the front of the file, so struck notes land exactly on the beat.
      const d = buf.getChannelData(0);
      let peak = 0, first = 0;
      for (let k = 0; k < d.length; k += 16) peak = Math.max(peak, Math.abs(d[k]));
      while (first < d.length && Math.abs(d[first]) < 0.02 * peak) first++;
      return { midi: n, buf, start: Math.max(0, first / buf.sampleRate - 0.002) };
    })).then((list) => {
      A.smp[inst] = list;
      if (inst === 'strings') A.stringLp.disconnect(); // real strings take over the West sound
    }, () => { /* keep the synthetic stand-in */ });
  }
}

// Plays one recorded note. att and rel are the fade in and out, in seconds.
function play(inst, t, out, midi, dur, vol, att = 0.004, rel = 0.15) {
  const set = A.smp[inst];
  const lo = set[0].midi - 4, hi = set[set.length - 1].midi + 4;
  while (midi > hi) midi -= 12; // outside the instrument's range: move by octaves until it fits
  while (midi < lo) midi += 12;
  let best = set[0];
  for (const v of set) if (Math.abs(v.midi - midi) < Math.abs(best.midi - midi)) best = v;
  const rate = Math.pow(2, (midi - best.midi) / 12);
  dur = Math.min(dur, (best.buf.duration - best.start) / rate);
  att = Math.min(att, dur / 2); rel = Math.min(rel, dur / 2);
  const src = ctx.createBufferSource(); src.buffer = best.buf; src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.setValueAtTime(vol, t + dur - rel); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(g); g.connect(out); src.start(t, best.start); src.stop(t + dur + 0.05);
  return { g, src, vol };
}

// Plays a one-off sound. Returns false if it hasn't loaded, so the caller can use its synthetic version.
function hit(name, t, out, vol) {
  const v = A.smp.hit && A.smp.hit.find((x) => x.midi === name);
  if (!v) return false;
  const src = ctx.createBufferSource(); src.buffer = v.buf;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(out); src.start(t, v.start);
  return true;
}

// A timpani roll that swells through one bar and ends on the next downbeat, tuned to the key.
function timpRoll(t, root, len) {
  const v = A.smp.hit && A.smp.hit.find((x) => x.midi === 'timproll');
  if (!v) return;
  const semis = (((root - 45) % 12) + 18) % 12 - 6; // the roll was recorded on A
  const rate = Math.pow(2, semis / 12), avail = (v.buf.duration - v.start) / rate;
  const src = ctx.createBufferSource(); src.buffer = v.buf; src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.1);
  g.gain.setValueAtTime(1, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.15);
  src.connect(g); g.connect(A.fx);
  src.start(t, v.start + Math.max(0, avail - len) * rate); src.stop(t + len + 0.2);
}

// A held chord from a bowed or sung instrument. It is played again every few bars (a breath, or a new bow),
// and moves at once when the chord changes. amt = how loud (0 = silent).
const held = {};
function sustain(name, inst, out, t, notes, amt, bars) {
  if (!A.smp[inst]) return;
  const st = held[name] || (held[name] = { key: '', bars: 0, voices: [] });
  const key = amt > 0.01 ? notes.join() + '|' + amt.toFixed(2) : '';
  if (key === st.key && (!key || ++st.bars < bars)) return;
  if (key !== st.key) { // let go of the old chord
    for (const { g, src, vol } of st.voices) {
      if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(t); else { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(vol, t); }
      g.gain.setTargetAtTime(0, t, 0.2);
      try { src.stop(t + 1.2); } catch { /* already stopped */ }
    }
  }
  st.key = key; st.bars = 0; st.voices = [];
  if (!key) return;
  const len = 60 / seq.bpm * 4 * bars;
  for (const m of notes) st.voices.push(play(inst, t, out, m, len + 1, amt, 0.5, 1));
}
const CHOIR_VOL = 0.75, STRINGS_VOL = 0.6, WEST_VOL = 1;

const VOWELS = [[700, 1100, 2600], [450, 800, 2600]]; // resonances for "ah" and "oh"

function setPadChord(chord, t) {
  const root = TRACKS[settings.track].root + chap.shift;
  const choir = TRACKS[settings.track].kit.pad === 'choir';
  const padWave = choir ? 'sawtooth' : TRACKS[settings.track].kit.pad;
  A.padDry.gain.setTargetAtTime(choir ? 0 : 1, t, 0.1);
  A.choirOut.gain.setTargetAtTime(choir && !A.smp.choir ? 1 : 0, t, 0.1); // the synthetic choir only stands in for the recorded one
  A.vib.gain.setTargetAtTime(choir ? 9 : 0, t, 0.1);
  A.roomWet.gain.setTargetAtTime(TRACKS[settings.track].kit.room ?? 0.35, t, 0.3);
  // The choir sings "ah" on one chord and "oh" on the next.
  if (choir) VOWELS[seq.ci & 1].forEach((hz, k) => A.formants[k].frequency.setTargetAtTime(hz, t, 0.4));
  for (const { o, v } of A.padOsc) {
    if (o.type !== padWave) o.type = padWave;
    // Every other pass through the sequence, the lowest voice moves up an octave for a different colour.
    const lift = (seq.cycle & 1) && v === 0 ? 12 : 0;
    o.frequency.setTargetAtTime(mtof(root + 12 + chord.r + chord.iv[v] + lift), t, 0.06);
  }
  for (const { o, semis } of A.drone) o.frequency.setTargetAtTime(mtof(root + chord.r + semis), t, 0.12);
  for (const { o, v } of A.strings) o.frequency.setTargetAtTime(mtof(root + 24 + chord.r + chord.iv[v]), t, 0.1);
}

// North's bell: a pure tone with fainter rings an octave and a twelfth above, so it stays in tune with the band.
function bell(t, midi, vol) {
  if (A.smp.celeste) return void play('celeste', t, A.dirGain.N, midi, 2.2, vol * 1.6);
  for (const [mult, v, dur] of [[1, vol, 1.0], [2, vol * 0.3, 0.5], [3, vol * 0.1, 0.3]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = mtof(midi) * mult;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.dirGain.N); o.start(t); o.stop(t + dur + 0.02);
  }
}

function setTempoFx(t) {
  const beat = 60 / seq.bpm;
  A.delay.delayTime.setTargetAtTime(beat * 0.75, t, 0.05);
  A.eDelay.delayTime.setTargetAtTime(beat * 0.5, t, 0.05);
}

// punch (0-1) is how hard the car is accelerating: a sharper attack, a click on top and a longer tail.
function kick(t, pump, punch) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  const kit = TRACKS[settings.track].kit;
  const tail = kit.kickTail + 0.14 * punch;
  o.frequency.setValueAtTime(kit.kickHz + 70 * punch, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + tail);
  o.connect(g); g.connect(A.layer.kick); o.start(t); o.stop(t + tail + 0.03);
  if (punch > 0.2) noiseHit(t, A.layer.kick, 'highpass', 2500, 0.02, 0.5 * punch);
  A.duck.gain.setValueAtTime(1 - pump, t); A.duck.gain.linearRampToValueAtTime(1, t + 0.22);
}

function noiseHit(t, out, type, freq, dur, vol) {
  const s = ctx.createBufferSource(); s.buffer = A.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}

// Mallet: a struck wooden bar. A pure tone that dies away, with a short high "knock" at the start.
function mallet(t, out, midi, dur, vol, detune) {
  for (const [mult, v, d] of [[1, vol, Math.max(dur, 0.4)], [4, vol * 0.3, 0.07]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = mtof(midi) * mult; o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02);
  }
}

// Voice: sung by the recorded choir when it has loaded. Otherwise a synthetic singer on "oo": A buzzy tone shaped by two resonances, easing in rather than striking.
function voice(t, out, midi, dur, vol, detune) {
  dur = Math.max(dur, 0.3);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi); o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
  g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  for (const [hz, v] of [[420, 3], [850, 1.6]]) {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = 6;
    const fg = ctx.createGain(); fg.gain.value = v;
    o.connect(f); f.connect(fg); fg.connect(g);
  }
  if (dur > 0.6) { // a held note gets a singer's wobble, arriving a moment after the note starts
    const v = ctx.createGain(); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(11, t + 0.5);
    A.vibLfo.connect(v); v.connect(o.detune);
    o.onended = () => { try { A.vibLfo.disconnect(v); } catch { /* already gone */ } };
  }
  g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}

// Instrument names that have a recording, how loud each plays, and the synth tone that stands in for it.
const REAL = { mallet: 'marimba', voice: 'choir', piano: 'piano', harp: 'harp', celeste: 'celeste', strings: 'strings' };
const REAL_VOL = { marimba: 0.85, choir: 1.7, piano: 1.6, harp: 1.0, celeste: 1.2, strings: 1.5 };
const STANDIN = { piano: 'triangle', harp: 'triangle', celeste: 'sine', strings: 'sawtooth' };

function pluck(t, out, midi, wave, dur, vol, cutoff, detune = 0) {
  const inst = REAL[wave];
  if (inst && A.smp[inst]) {
    if (inst === 'choir') return play(inst, t, out, midi, Math.max(dur, 0.4), vol * REAL_VOL.choir, 0.05, 0.2);
    if (inst === 'strings') return play(inst, t, out, midi, Math.max(dur, 0.5), vol * REAL_VOL.strings, 0.06, 0.25);
    return play(inst, t, out, midi, Math.max(dur * 2.5, 1.2), vol * REAL_VOL[inst]); // struck or plucked: let it ring
  }
  wave = STANDIN[wave] || wave;
  if (wave === 'mallet') return mallet(t, out, midi, dur, vol, detune);
  if (wave === 'voice') return voice(t, out, midi, dur, vol, detune);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.4;
  f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  f.connect(g); g.connect(out);
  // Above the bass register each note is two slightly out-of-tune copies, which sounds like an
  // instrument with some width instead of a single thin beep.
  const pair = midi >= 48 ? [-6, 6] : [0];
  for (const d of pair) {
    const o = ctx.createOscillator();
    if (wave === 'triangle' || wave === 'sine') o.setPeriodicWave(A.warm);
    else if (wave === 'square') o.setPeriodicWave(A.hollow);
    else o.type = wave;
    o.frequency.value = mtof(midi); o.detune.value = detune + d;
    const og = ctx.createGain(); og.gain.value = pair.length === 2 ? 0.62 : 1;
    o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.02);
  }
}

function snareHit(t, vol) {
  const kit = TRACKS[settings.track].kit;
  if (kit.handHz) { // a hand drum instead of a snare: a conga, or a pitched thud with a little slap
    if (hit(vol > 0.8 ? 'conga' : 'congamute', t, A.layer.snare, 1.0 * vol)) return;
    tom(t, kit.handHz, 0.8 * vol);
    return noiseHit(t, A.layer.snare, 'bandpass', kit.snareHz, kit.snareDur, 0.35 * vol);
  }
  noiseHit(t, A.layer.snare, 'bandpass', kit.snareHz, kit.snareDur, 0.9 * vol);
  pluck(t, A.layer.snare, 55, 'triangle', 0.1, 0.5 * vol, 900);
}

function tom(t, hz, vol = 0.9) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(hz * 1.5, t); o.frequency.exponentialRampToValueAtTime(hz, t + 0.08);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g); g.connect(A.layer.snare); o.start(t); o.stop(t + 0.26);
}

// Crash cymbal plus a low thump: marks a hard launch, a new section or a new track.
function crash(t, vol = 1) {
  if (!hit('cymbal', t, A.fx, 1.1 * vol)) noiseHit(t, A.fx, 'highpass', 4500, 1.8, 0.7 * vol);
  if (A.smp.timp) return void play('timp', t, A.fx, TRACKS[settings.track].root + chap.shift, 2, 1.4 * vol); // a timpani stroke on the key note
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
  g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  o.connect(g); g.connect(A.fx); o.start(t); o.stop(t + 1);
}

function scheduleStep(t) {
  let tr = TRACKS[settings.track];
  const i = seq.step;

  if (i === 0) {
    // Section changes land on a bar line. A new direction or zone restarts the 8-bar chord sequence.
    const zoned = seq.zone !== mix.zoneWant;
    if (zoned || seq.dir !== mix.dirWant) {
      seq.dir = mix.dirWant; seq.zone = mix.zoneWant;
      if (!tr.canon) { // the Canon is one loop everywhere, so it just carries on
        if (seq.bar !== 0) { seq.bar = 0; seq.cycle++; }
        if (seq.cycle % 8 === 7) seq.cycle++; // never open a new section with a breakdown
        firstChord();
      }
      if (zoned && seq.zone === 'highway') crash(t);
    }
    const n = Math.floor(seq.cycle / 8);
    if (seq.bar === 0 && n !== chap.n) {
      // A new chapter. This is also the only place a track may rotate, and the tempo carries over.
      const mins = ROTATE[settings.rotate];
      if (mins && t - seq.trackStart > mins * 60) {
        const ids = Object.keys(TRACKS);
        settings.track = ids[(ids.indexOf(settings.track) + 1) % ids.length]; // not saved: the chosen track is still the starting point
        seq.trackStart = t;
        tr = TRACKS[settings.track];
      }
      chap = makeChapter(settings.track, n);
      firstChord();
      if (mix.level.kick > 0.5) crash(t, 0.7);
    }
    setPadChord(currentChord(), t);
  }
  if (seq.launch) { seq.launch = false; crash(t); }

  const chord = currentChord();
  const root = tr.root + chap.shift;
  const L = mix.level, I = mix.intensity, surge = mix.surge;
  const s16 = 60 / seq.bpm / 4;
  const highway = seq.zone === 'highway';
  const driving = highway || surge > 0.5; // the busier groove
  const g = driving ? tr.hw : tr.street;
  const bassPattern = driving ? tr.hw.bass : chap.bass;
  const bright = 1 + 0.3 * mix.bright;

  // The shape of a chapter, in 8-bar passes: melody A, melody B, no melody, C, D, A, B,
  // then a breakdown and a build that lead into the next chapter.
  const form = seq.cycle % 8;
  const calm = surge < 0.3; // never interrupt hard acceleration
  const breakdown = form === 7 && seq.bar < 4 && calm;  // drums and bass drop out for four bars
  const build = form === 7 && seq.bar === 7 && calm;    // a snare build brings them back
  if (i === 0) {
    // Held chords from the recorded choir and strings. The choir is Cathedral's pad; elsewhere both join where
    // the kit says, and the choir swells in every breakdown while the drums are away.
    const ck = tr.kit.choir || {}, sk = tr.kit.strings || {};
    const swell = breakdown && L.kick > 0.3 ? 0.7 : 0;
    const low = root + 12 + chord.r, mid = low + 12;
    sustain('choir', 'choir', A.choirSung, t, chord.iv.map((v) => low + v),
      (tr.kit.pad === 'choir' ? 1 : Math.max((highway ? ck.hw : ck.street) || 0, swell)) * CHOIR_VOL, 2);
    sustain('strings', 'strings', A.choirSung, t, [low, mid + chord.iv[1], mid + chord.iv[2], mid + 12],
      ((highway ? sk.hw : sk.street) || 0) * STRINGS_VOL, 1);
    sustain('west', 'strings', A.dirGain.W, t, chord.iv.slice(0, 3).map((v) => mid + v), mix.dirW.W > 0.03 ? WEST_VOL : 0, 1);
    if (build && L.kick > 0.3) timpRoll(t, root, s16 * 16);
  }
  const fill = seq.bar === 7 && i >= 12 && surge <= 0.5 && !build && L.snare > 0.01; // drum fill ending each pass
  const fillKind = seq.cycle % 3;

  if (L.kick > 0.01 && !breakdown) {
    const hit = fill && fillKind === 1 ? i < 14 : fill && fillKind === 2 ? false : g.kick[i] === 'x';
    if (hit) kick(t, 0.12 + 0.45 * Math.max(surge, highway ? 0.6 : 0), surge);
  }
  if (L.snare > 0.01 && !breakdown) {
    if (build) { if (i % 4 === 0 || (i >= 8 && i % 2 === 0) || i >= 12) snareHit(t, 0.3 + 0.045 * i); }
    else if (fill) {
      if (fillKind === 0) snareHit(t, 0.4 + 0.16 * (i - 12));         // snare run
      else if (fillKind === 1) { if (i >= 14) snareHit(t, i === 15 ? 1 : 0.7); } // two kicks, two snares
      else tom(t, [220, 180, 140, 110][i - 12]);                       // toms falling
    }
    else if (g.snare[i] === 'x') snareHit(t, 1);
    else if (surge > 0.5 && (seq.bar & 1) && i >= 12) snareHit(t, 0.35 + 0.15 * (i - 12)); // roll into the next bar
  }
  if (L.hats > 0.01) {
    const h = tr.street.hat[i]; // hats keep the same pace in every zone, so the song never seems to speed up
    if ((h === 'o' || (h === 'x' && !breakdown)) && !(tr.kit.shaker && hit('shaker', t, A.layer.hats, 1.1))) {
      noiseHit(t, A.layer.hats, 'highpass', tr.kit.hatHz, h === 'o' ? 0.1 : 0.04, 0.8);
    }
  }
  if (L.bass > 0.01 && bassPattern[i] === 'x' && !breakdown) {
    // Driving groove: steady eighth notes, low on the beat and an octave up in between, with a brighter bite.
    const bounce = driving && i % 4 === 2 ? 12 : 0;
    pluck(t, A.layer.bass, root - 12 + chord.r + bounce, tr.bassWave, s16 * 1.7, driving ? 1 : 0.9, (500 + I * 1800) * (driving ? 1.6 : 1));
    // Under acceleration a second, hollower voice doubles the bass to thicken it.
    if (surge > 0.3) pluck(t, A.layer.bass, root - 12 + chord.r + bounce, 'square', s16 * 1.7, 0.45 * surge, 900 + 1400 * surge);
  }
  if (tr.canon) {
    // The Canon. From 19 mph a voice sings the slow tune, one long note per chord.
    // From 23 mph a second part joins and changes from pass to pass:
    // nothing, the strings in harmony, the running figure, then the figure twice as fast.
    const base = root + 24, ci = seq.ci, moving = input.speed >= 0.4;
    if (i === 0 && seq.held % 2 === 0 && moving) {
      if (L.arp > 0.01) pluck(t, A.layer.arp, base + CANON.a[ci], 'voice', s16 * 17, 1, 0);
      if (L.lead > 0.01 && (form === 1 || form === 4)) pluck(t, A.layer.lead, base + CANON.b[ci], 'strings', s16 * 17, 0.8, 0);
    }
    const fast = form === 3 || form === 6, every = fast ? 2 : 4;
    if (L.lead > 0.01 && (fast || form === 2 || form === 5) && i % every === 0) {
      pluck(t, A.layer.lead, base + CANON.fig[ci][(i / every) % 4], chap.leadWave, s16 * (fast ? 2.4 : 4.5), 0.6, 2600 * bright);
    }
  } else {
    // Arp pattern changes every pass, and again halfway through.
    const ai = chap.arps[(seq.cycle + (seq.bar >= 4 ? 1 : 0)) % chap.arps.length][i];
    if (L.arp > 0.01 && ai != null) {
      pluck(t, A.layer.arp, root + 24 + chord.r + chord.iv[ai], chap.arpWave, s16 * 1.4, 0.7, (1200 + I * 3000) * bright);
    }
    // Lead: the highway has its own melodies, trading two phrases bar by bar with a thicker sound.
    // The street plays one phrase every other bar, then answers with the next phrase in the second half.
    const leads = chap.leads[seq.zone];
    const ln = leads[(seq.cycle + (highway ? seq.bar & 1 : seq.bar >= 4 ? 1 : 0)) % leads.length][i];
    if (L.lead > 0.01 && ln != null && form !== 2 && (driving || (seq.bar & 1) === 0)) {
      pluck(t, A.layer.lead, root + 24 + ln, chap.leadWave, s16 * 3.5, 0.7, 2600 * bright);
      if (highway) pluck(t, A.layer.lead, root + 24 + ln, tr.kit.hwLead || tr.kit.stab || 'sawtooth', s16 * 3.5, 0.45, 2600 * bright, 14);
    }
  }
  if (L.stabs > 0.01 && STAB[i] === 'x' && !breakdown) {
    for (let v = 0; v < 3; v++) {
      pluck(t, A.layer.stabs, root + 24 + chord.r + chord.iv[v], tr.kit.stab || 'sawtooth', s16 * 1.8, 0.45, 3500 * bright);
    }
  }

  // Compass sounds that are played as notes (the drone and strings sound continuously).
  if (mix.dirW.N > 0.03 && (i === 0 || i === 6 || i === 10)) {
    // Bells only use notes of the chord that also belong to the melody's five-note scale, so they never clash with it.
    const safe = chord.iv.slice(0, 3).map((v) => chord.r + v).filter((nn) => PENT[tr.scale].includes(((nn % 12) + 12) % 12));
    const pool = safe.length ? safe : [0, 7];
    bell(t, root + 36 + pool[(i + seq.bar) % pool.length], 0.5);
  }
  if (mix.dirW.E > 0.03 && E_PLUCK[i] === 'x') {
    pluck(t, A.dirGain.E, root + 24 + chord.r + chord.iv[[0, 2, 1, 3][(i + seq.bar) % 4]], 'harp', s16 * 0.9, 0.8, 3200);
  }

  seq.step = (i + 1) % 16;
  // While the car is stopped the music holds its chord: the story only moves when you do.
  if (seq.step === 0 && input.speed >= 0.4) {
    seq.bar = (seq.bar + 1) % 8;
    if (seq.bar === 0) seq.cycle++;
    // Next chord once the car has covered the distance: after 2, 4 or 6 bars, and never later than 8.
    seq.held++; seq.dist += input.speed * s16 * 16;
    // The Canon is the exception: its tune only makes sense at its own pace, so it gets a new chord every bar.
    if (tr.canon || seq.held >= 8 || (seq.held % 2 === 0 && seq.dist >= CHORD_M)) {
      seq.ci = (seq.ci + 1) % 8; seq.held = 0; seq.dist = 0;
    }
  }
}

function scheduler() {
  const tr = TRACKS[settings.track];
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05; // recover after a stall
  // Notes are booked a quarter of a second ahead, so a busy phone can't make the beat stumble.
  while (nextTime < ctx.currentTime + 0.25) {
    const even = seq.step % 2 === 0;
    scheduleStep(nextTime);
    nextTime += (60 / seq.bpm / 4) * (even ? 1 + tr.swing : 1 - tr.swing);
  }
}

/* ---------- Sensors ---------- */
const IOS = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
const gps = { target: 0, long: 0, lastV: null, lastT: 0, lastPos: null, anchor: null, heading: null, fixAt: 0, acc: null, denied: false };
const motion = { turn: 0, horiz: 0, seen: false, grav: null };
let geoId = null, wakeLock = null;
const RAD = Math.PI / 180;

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * RAD, dLon = (b.longitude - a.longitude) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a, b) {
  const y = Math.sin((b.longitude - a.longitude) * RAD) * Math.cos(b.latitude * RAD);
  const x = Math.cos(a.latitude * RAD) * Math.sin(b.latitude * RAD)
    - Math.sin(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.cos((b.longitude - a.longitude) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

function onPosition(p) {
  const c = p.coords, t = p.timestamp;
  gps.fixAt = performance.now(); gps.acc = c.accuracy; gps.denied = false;
  if (c.accuracy > 60) return; // too vague to trust
  const here = { latitude: c.latitude, longitude: c.longitude, t };
  let v = c.speed;
  if (v == null || Number.isNaN(v) || v < 0) {
    // No speed from the device: estimate from distance moved.
    v = null;
    if (gps.lastPos) {
      const dt = (t - gps.lastPos.t) / 1000, dist = haversine(gps.lastPos, c);
      if (dt > 0.3) v = dist < 3 ? 0 : dist / dt;
    }
  }
  gps.lastPos = here;
  if (v == null) return;

  // Direction of travel: the device's own heading when it gives one, else the bearing over the last 12 m.
  let h = null;
  if (c.heading != null && !Number.isNaN(c.heading) && c.heading >= 0 && v > 2) h = c.heading;
  if (!gps.anchor) gps.anchor = here;
  else if (haversine(gps.anchor, here) > 12) { if (h == null) h = bearing(gps.anchor, here); gps.anchor = here; }
  if (h != null) {
    if (gps.heading == null) gps.heading = h;
    else gps.heading = (gps.heading + (((h - gps.heading + 540) % 360) - 180) * 0.5 + 360) % 360;
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
  Object.assign(gps, { target: 0, long: 0, lastV: null, lastPos: null, anchor: null, heading: null, fixAt: 0, acc: null });
  Object.assign(motion, { turn: 0, horiz: 0, seen: false, grav: null });
}

async function holdWake() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
  catch { /* not allowed right now */ }
}

/* ---------- Simulator ---------- */
const sim = { gas: false, floor: false, brake: false, steer: 0, v: 0, heading: 0 };

function simStep(dt) {
  let a;
  if (sim.brake) a = -6.5;
  else if (sim.floor) a = 3.6 * (1 - sim.v / 50); // foot down
  else if (sim.gas) a = 1.3 * (1 - sim.v / 50);   // gentle
  else a = -0.25 - 0.012 * sim.v;
  const before = sim.v;
  sim.v = Math.max(0, sim.v + a * dt);
  const real = (sim.v - before) / dt / 9.81;
  input.speed = sim.v;
  input.long += (real - input.long) * 0.3;
  input.turn = sim.v > 1 ? sim.steer * 28 : 0;
  sim.heading = (sim.heading + input.turn * dt + 360) % 360;
  input.heading = sim.heading;
}

function driveStep(dt) {
  input.speed += (gps.target - input.speed) * Math.min(1, dt * 2.5);
  if (input.speed < 0.3 && gps.target === 0) input.speed = 0;
  const turn = Math.abs(motion.turn) > 1.5 && input.speed > 1 ? motion.turn : 0;
  // The accelerometer reacts faster than GPS; GPS says whether it is speeding up or slowing down.
  const lat = (input.speed * turn * RAD) / 9.81;
  const fwd = Math.sqrt(Math.max(0, motion.horiz ** 2 - lat ** 2));
  let long = gps.long;
  if (Math.abs(long) > 0.03) long = Math.sign(long) * Math.max(Math.abs(long), Math.min(fwd, 0.6));
  if (performance.now() - gps.fixAt > 4000) long = 0;
  input.long += (long - input.long) * Math.min(1, dt * 4);
  input.turn = turn;
  input.heading = gps.heading;
}

/* ---------- Mixing: inputs -> sound ---------- */
// Stay with the current direction until the heading is clearly inside another quarter.
function pickDir(h, cur) {
  const off = Math.abs(((h - DIRS.indexOf(cur) * 90 + 540) % 360) - 180);
  return off <= 55 ? cur : DIRS[Math.round(h / 90) % 4];
}

function control() {
  const dt = 0.05, now = performance.now();
  if (settings.source === 'sim') simStep(dt); else driveStep(dt);

  const moving = input.speed >= 0.4;
  const boost = clamp(input.long / 0.25), brake = clamp(-input.long / 0.3);
  mix.boost = boost; mix.brake = brake;

  // Surge: hard acceleration. Rises fast, lets go slowly so a gear change doesn't cut it off.
  const surgeTarget = moving ? clamp((input.long - 0.1) / 0.15) : 0;
  const was = mix.surge;
  mix.surge += (surgeTarget - mix.surge) * (surgeTarget > mix.surge ? 0.3 : 0.03);
  if (was < 0.6 && mix.surge >= 0.6 && now - seq.lastLaunch > 8000) { seq.launch = true; seq.lastLaunch = now; }
  const surge = mix.surge;

  // Zone: street or highway, with a gap between the two thresholds so it doesn't flicker.
  const hwy = HWY[settings.hwy];
  if (mix.zoneWant === 'street' && input.speed > hwy) mix.zoneWant = 'highway';
  else if (mix.zoneWant === 'highway' && input.speed < hwy * 0.85) mix.zoneWant = 'street';
  const highway = mix.zoneWant === 'highway';

  // Compass: pick the chord sequence, and lean brighter heading north, darker heading south.
  if (input.heading != null) {
    mix.dirWant = pickDir(input.heading, mix.dirWant);
    mix.bright += (Math.cos(input.heading * RAD) - mix.bright) * 0.05;
  }

  const eff = Math.max(0, input.speed + boost * 2 - brake * 1.5); // m/s, nudged by the pedals
  const mph = moving ? eff * 2.23694 : 0;

  // Compass sounds: each one's share is cos² of how far the heading is from its direction,
  // so two neighbours always add up to a whole and fade smoothly into each other. They fade in over the first 8 mph.
  const presence = clamp(mph / 8);
  DIRS.forEach((d, k) => {
    const c = input.heading == null ? 0 : Math.max(0, Math.cos((input.heading - k * 90) * RAD));
    mix.dirW[d] += (c * c * presence - mix.dirW[d]) * 0.08;
    A.dirGain[d].gain.setTargetAtTime(mix.dirW[d] * DIR_VOL[d], ctx.currentTime, 0.3);
  });
  let I = highway ? 0.75 + 0.25 * clamp((input.speed - hwy) / (hwy * 0.5)) : 0.65 * clamp(eff / 11.2);
  I = moving ? clamp(I + surge * 0.15) : 0;
  mix.intensity = I;

  const t = ctx.currentTime;
  for (const name of LAYERS) {
    let lv = name === 'stabs' ? (highway ? 1 : clamp((surge - 0.3) / 0.4)) : clamp((mph - JOIN[name]) / 3);
    if (name === 'bass' || name === 'kick' || name === 'hats' || name === 'snare') lv = Math.max(lv, surge); // surge brings the beat in early
    if (name === 'kick' || name === 'hats' || name === 'snare') lv *= 1 - brake * 0.85; // drums thin out under braking
    if (!moving && name !== 'pad') lv = 0;
    mix.level[name] = lv;
    // Under acceleration the kick and bass step forward and the melodic layers step back to make room.
    const focus = name === 'kick' || name === 'bass' ? 1 + 0.4 * surge : name === 'pad' || name === 'arp' || name === 'lead' ? 1 - 0.3 * surge : 1;
    A.layer[name].gain.setTargetAtTime(lv * VOL[name] * focus, t, 0.18);
  }
  const drift = 1 + 0.25 * Math.sin(now / 1000 * 2 * Math.PI * 0.05); // slow sweep so a held chord still moves
  A.padFilter.frequency.setTargetAtTime((280 + 3200 * I) * drift * (1 + 0.3 * mix.bright), t, 0.3);
  A.wet.gain.setTargetAtTime(Math.max(0.05, TRACKS[settings.track].kit.echo - 0.1 * mix.bright), t, 0.5);
  A.lp.frequency.setTargetAtTime(18000 * Math.pow(0.03, brake), t, 0.12); // braking closes the filter
  const turnN = clamp(input.turn / 25, -1, 1);
  if (A.pan.pan) A.pan.pan.setTargetAtTime(turnN * 0.8, t, 0.2);
  A.fb.gain.setTargetAtTime(0.28 + 0.4 * Math.abs(turnN), t, 0.2);

  if (settings.source === 'sim') statusText = 'Simulating';
  else if (gps.denied) statusText = 'Location is off — allow it to read speed';
  else if (!gps.fixAt) statusText = 'Waiting for GPS…';
  else if (now - gps.fixAt > 6000) statusText = 'GPS signal lost';
  else statusText = `GPS ±${Math.round(gps.acc)} m${motion.seen ? '' : ' · no motion sensor'}`;
}

/* ---------- Start / stop ---------- */
async function start() {
  if (running) return;
  if (!ctx) { buildAudio(); loadSounds(); }
  for (const k in held) held[k].key = '';
  ctx.resume(); // must happen inside the tap
  running = true;
  Object.assign(seq, { step: 0, bar: 0, cycle: 0, zone: 'street', launch: false, trackStart: ctx.currentTime, bpm: TRACKS[settings.track].bpm });
  chap = makeChapter(settings.track, 0);
  mix.zoneWant = 'street';
  applyTrack();
  nextTime = ctx.currentTime + 0.1;
  A.master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.4); // headroom for the louder kick and bass under acceleration
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
  Object.assign(sim, { gas: false, floor: false, brake: false, v: 0 });
  Object.assign(input, { speed: 0, long: 0, turn: 0, heading: null });
  Object.assign(mix, { intensity: 0, boost: 0, brake: 0, surge: 0, zoneWant: 'street' });
  for (const l of LAYERS) mix.level[l] = 0;
  for (const d of DIRS) mix.dirW[d] = 0;
  eqLevels.fill(0);
  if (wakeLock) wakeLock.release().catch(() => {});
  statusText = 'Ready';
  render();
  if (updateReady) location.reload();
}

function applyTrack() {
  if (!ctx) return;
  setTempoFx(ctx.currentTime);
  setPadChord(currentChord(), ctx.currentTime);
}

async function setSource(src) {
  settings.source = src; store.set('rm.source', src);
  if (running) {
    stopSensors(); sim.v = input.speed;
    if (src === 'drive') await startSensors();
  }
}

/* ---------- UI ---------- */
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
let frameQueued = false;

function chooseTrack(id) {
  settings.track = id; store.set('rm.track', id);
  // Choosing a track starts its story from chapter 1, at its own tempo.
  seq.cycle = 0; seq.bar = 0; seq.step = 0; seq.bpm = TRACKS[id].bpm;
  firstChord();
  chap = makeChapter(id, 0);
  if (ctx) seq.trackStart = ctx.currentTime; // restart the rotation clock
  applyTrack();
  render();
}

function buildUI() {
  for (const [id, t] of Object.entries(TRACKS)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = id;
    const name = document.createElement('b'); name.textContent = t.name;
    const vibe = document.createElement('span'); vibe.textContent = t.vibe;
    b.append(name, vibe);
    b.onclick = () => chooseTrack(id);
    $('#tracks').appendChild(b);
  }

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
  hold($('#gas'), 'gas'); hold($('#floor'), 'floor'); hold($('#brake'), 'brake');
  const steer = $('#steer');
  steer.oninput = () => { sim.steer = +steer.value; };
  const center = () => { steer.value = 0; sim.steer = 0; };
  steer.addEventListener('pointerup', center); steer.addEventListener('pointercancel', center);

  const keys = { ArrowUp: ['gas', true], f: ['floor', true], ArrowDown: ['brake', true], ArrowLeft: ['steer', -1], ArrowRight: ['steer', 1] };
  addEventListener('keydown', (e) => { const k = keys[e.key]; if (k && settings.source === 'sim') { sim[k[0]] = k[1]; e.preventDefault(); } });
  addEventListener('keyup', (e) => { const k = keys[e.key]; if (k) sim[k[0]] = k[0] === 'steer' ? 0 : false; });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running) { holdWake(); ctx.resume(); }
  });
}

// Equalizer: 20 bars from low notes (left) to high (right), rising fast and falling slowly.
const eqData = new Uint8Array(256), eqLevels = new Array(20).fill(0);

function drawEq() {
  const c = $('#eq'), g = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  if (running && A) A.analyser.getByteFrequencyData(eqData);
  const n = eqLevels.length, gap = 6, bw = (w - gap * (n - 1)) / n;
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#3ad6ff'); grad.addColorStop(1, '#ff4fd8');
  g.fillStyle = mix.brake > 0.3 ? '#ff5a4f' : grad; // red while braking
  for (let k = 0; k < n; k++) {
    const lo = Math.floor(Math.pow(128, k / n)), hi = Math.max(lo + 1, Math.floor(Math.pow(128, (k + 1) / n)));
    let peak = 0;
    for (let bin = lo; bin < hi; bin++) peak = Math.max(peak, eqData[bin]);
    const target = running ? peak / 255 : 0;
    eqLevels[k] += (target - eqLevels[k]) * (target > eqLevels[k] ? 0.6 : 0.15);
    const bh = Math.max(4, eqLevels[k] * h), x = k * (bw + gap);
    if (g.roundRect) { g.beginPath(); g.roundRect(x, h - bh, bw, bh, Math.min(4, bw / 2)); g.fill(); }
    else g.fillRect(x, h - bh, bw, bh);
  }
}

function render() {
  const kmh = settings.units === 'kmh';
  const speed = running ? `${Math.round(input.speed * (kmh ? 3.6 : 2.23694))} ${kmh ? 'km/h' : 'mph'}` : '';
  const zone = !running ? '' : input.speed < 0.4 ? 'Idle' : mix.surge > 0.5 ? 'Surge' : mix.zoneWant === 'highway' ? 'Highway' : 'Street';
  const point = input.heading == null ? '' : POINTS[Math.round(input.heading / 45) % 8];
  $('#zone').textContent = [speed, zone, point, running ? 'Ch ' + (chap.n + 1) : ''].filter(Boolean).join(' · ');
  for (const b of $('#hwy').children) b.textContent = HWY_LABEL[kmh ? 'kmh' : 'mph'][b.dataset.v];
  for (const b of $('#tracks').children) b.setAttribute('aria-pressed', b.dataset.id === settings.track); // follows track rotation
  $('#status').textContent = statusText;
  $('#go').textContent = running ? 'Stop' : 'Start';
  $('#go').classList.toggle('on', running);
  $('#sim').hidden = settings.source !== 'sim';
  drawEq();
  if (running && !frameQueued) {
    frameQueued = true;
    requestAnimationFrame(() => { frameQueued = false; render(); });
  }
}

buildUI();
render();
window.revmix = { input, mix, seq, sim, settings, TRACKS, makeChapter, get chap() { return chap; }, get audio() { return A; }, get ctx() { return ctx; } }; // handy for debugging

/* ---------- Updates ---------- */
// An installed app is rarely reloaded by the phone, so it checks for a new version itself:
// on launch, whenever it comes back to the foreground, and from the "Check for updates" link.
// The version code is a fingerprint of the app's own files, so nothing needs bumping by hand.
let loadedPrint = null, updateReady = false;

async function fingerprint() {
  const parts = await Promise.all(['./', 'app.js', 'style.css'].map((f) => fetch(f, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.text();
  })));
  let h = 5381;
  const all = parts.join('\n');
  for (let i = 0; i < all.length; i++) h = ((h * 33) ^ all.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0').slice(0, 6);
}

async function checkUpdate(manual) {
  const link = $('#update');
  try {
    if (manual) link.textContent = 'Checking…';
    const now = await fingerprint();
    if (loadedPrint == null) loadedPrint = now;
    $('#version').textContent = 'Version ' + loadedPrint;
    if (now !== loadedPrint) {
      if (!running) { location.reload(); return; }
      updateReady = true; // don't interrupt the music; reload when it stops
      link.textContent = 'Update ready — tap to reload';
    } else if (manual) {
      link.textContent = 'Up to date';
      setTimeout(() => { if (!updateReady) link.textContent = 'Check for updates'; }, 2500);
    }
  } catch {
    if (manual) { link.textContent = 'Could not check — offline?'; setTimeout(() => { link.textContent = 'Check for updates'; }, 2500); }
  }
}

$('#update').onclick = () => (updateReady ? location.reload() : checkUpdate(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(false); });
checkUpdate(false);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
