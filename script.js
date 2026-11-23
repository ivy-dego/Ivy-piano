/* Ivy Piano Trainer v1.2 */
const $ = id => document.getElementById(id);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const HAND_COLOR = { left: '#4285dc', right: '#24a36f', both: '#9955bd' };
const midiName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const midiLetter = m => NAMES[m % 12];
const fmtBeats = b => String(Math.round(b * 1000) / 1000);

/* guitar constants (used by the parser too) */
const OPEN = [64, 59, 55, 50, 45, 40];   // string 1 (high E) ... string 6 (low E)
const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];
const FRETS = 17;

/* =====================  1. PICTURE (optional reference)  ===================== */
const preview = $('preview');
const pctx = preview.getContext('2d');
let original = null, base = null, sel = null, drag = null, pdfData = null, pdfDoc = null;

const imageStatus = t => { $('imageStatus').textContent = t; };
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function copyCanvas(src) { const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; }

function applyContrast(ctx, w, h) {
  const f = +$('contrast').value / 100;
  if (f === 1) return;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] - 128) * f + 128;
    d[i + 1] = (d[i + 1] - 128) * f + 128;
    d[i + 2] = (d[i + 2] - 128) * f + 128;
  }
  ctx.putImageData(img, 0, 0);
}
function renderOut() {
  const c = makeCanvas(base.width, base.height), x = c.getContext('2d');
  x.drawImage(base, 0, 0);
  applyContrast(x, c.width, c.height);
  return c;
}
function render() {
  if (!base) return;
  preview.width = base.width; preview.height = base.height;
  pctx.drawImage(base, 0, 0);
  applyContrast(pctx, base.width, base.height);
  if (sel && sel.w > 0 && sel.h > 0) {
    pctx.save();
    pctx.fillStyle = 'rgba(23,107,85,0.18)';
    pctx.strokeStyle = '#176b55';
    pctx.lineWidth = Math.max(2, base.width / 400);
    pctx.fillRect(sel.x, sel.y, sel.w, sel.h);
    pctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
    pctx.restore();
  }
}
function updateRef() {
  if (!base) return;
  $('refImage').src = renderOut().toDataURL('image/jpeg', 0.85);
  $('refImage').hidden = false;
  $('refEmpty').hidden = true;
}
function setBase(c) { base = c; sel = null; preview.hidden = false; render(); updateRef(); }
function setOriginal(c) { original = copyCanvas(c); setBase(c); }

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = makeCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
    img.src = url;
  });
}

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/';
async function loadPdfPage() {
  if (!pdfData) { imageStatus('Choose a PDF first.'); return; }
  imageStatus('Loading PDF…');
  if (!pdfDoc) {
    const pdfjs = await import(PDFJS + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
    pdfDoc = await pdfjs.getDocument({ data: pdfData.slice(0) }).promise;
  }
  const n = Math.min(Math.max(1, +$('page').value || 1), pdfDoc.numPages);
  $('page').value = n; $('page').max = pdfDoc.numPages;
  const pg = await pdfDoc.getPage(n);
  const vp = pg.getViewport({ scale: 2 });
  const c = makeCanvas(Math.round(vp.width), Math.round(vp.height));
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  setOriginal(c);
  imageStatus(`PDF page ${n} of ${pdfDoc.numPages} loaded. Drag on the preview to select a crop.`);
}

$('file').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    pdfData = null; pdfDoc = null;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      pdfData = await f.arrayBuffer();
      await loadPdfPage();
    } else {
      setOriginal(await loadImageFile(f));
      imageStatus('Image loaded. Drag on the preview to select a crop.');
    }
  } catch (err) { imageStatus('Error: ' + err.message); }
});
$('loadPage').addEventListener('click', () => loadPdfPage().catch(err => imageStatus('Error: ' + err.message)));
$('contrast').addEventListener('input', render);
$('contrast').addEventListener('change', updateRef);

$('rotate').addEventListener('click', () => {
  if (!base) return;
  const c = makeCanvas(base.height, base.width), x = c.getContext('2d');
  x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(base, 0, 0);
  setBase(c);
});
$('crop').addEventListener('click', () => {
  if (!base) return;
  if (!sel || sel.w < 5 || sel.h < 5) { imageStatus('Drag across the preview first to select an area.'); return; }
  const x = Math.round(sel.x), y = Math.round(sel.y), w = Math.round(sel.w), h = Math.round(sel.h);
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(base, x, y, w, h, 0, 0, w, h);
  setBase(c);
  imageStatus('Crop applied.');
});
$('reset').addEventListener('click', () => {
  if (!original) return;
  $('contrast').value = 100;
  setBase(copyCanvas(original));
  imageStatus('Reset to original.');
});
$('saveImage').addEventListener('click', () => {
  if (!base) { imageStatus('Load an image first.'); return; }
  renderOut().toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'prepared-sheet-music.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

function canvasPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: Math.min(Math.max((e.clientX - r.left) * preview.width / r.width, 0), preview.width),
    y: Math.min(Math.max((e.clientY - r.top) * preview.height / r.height, 0), preview.height)
  };
}
preview.addEventListener('pointerdown', e => { drag = canvasPoint(e); preview.setPointerCapture(e.pointerId); });
preview.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = canvasPoint(e);
  sel = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
  render();
});
preview.addEventListener('pointerup', () => { drag = null; });

/* =====================  2. NOTES EDITOR  ===================== */
let steps = [];   // [{beats, left:[midi], right:[midi], tabs:{midi:{string,fret}}}]

function parseBeats(s) {
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return a / b; }
  return Number(s);
}
function parseNoteToken(tok, defOct) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)?$/.exec(tok);
  if (!m) return null;
  const oct = m[3] !== undefined ? +m[3] : defOct;
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (oct + 1) + SEMI[m[1].toUpperCase()] + alter;
}
function parseHand(str, defOct, lineNo, errors, tabs) {
  const out = [];
  if (!str || str === '-') return out;
  for (const tok of str.split(/\s+/)) {
    if (tok === '-') continue;
    const t = /^([1-6])\/(\d{1,2})$/.exec(tok);          // guitar tab style: string/fret
    if (t) {
      const s = +t[1] - 1, f = +t[2];
      if (f > FRETS) { errors.push(`Line ${lineNo}: fret ${f} is too high (max ${FRETS})`); continue; }
      const m = OPEN[s] + f;
      if (!out.includes(m)) out.push(m);
      tabs[m] = { string: s, fret: f };
      continue;
    }
    const m = parseNoteToken(tok, defOct);
    if (m === null || m < 21 || m > 108) errors.push(`Line ${lineNo}: "${tok}" is not a valid note (letters C–B, # or b, octave number; or string/fret like 2/1)`);
    else if (!out.includes(m)) out.push(m);
  }
  return out.sort((a, b) => a - b);
}
function parseText(text) {
  const result = [], errors = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const p = line.split('|').map(s => s.trim());
    if (p.length !== 3) { errors.push(`Line ${i + 1}: use  beats | left hand | right hand`); return; }
    const beats = parseBeats(p[0]);
    if (!(beats > 0)) { errors.push(`Line ${i + 1}: beats must be a number above 0`); return; }
    const tabs = {};
    const left = parseHand(p[1], 3, i + 1, errors, tabs);
    const right = parseHand(p[2], 4, i + 1, errors, tabs);
    result.push({ beats, left, right, tabs });
  });
  return { steps: result, errors };
}

function renderLetters(list, activeIndex = -1) {
  const box = $('letters');
  box.innerHTML = '';
  list.forEach((s, i) => {
    const all = [...new Set([...s.left, ...s.right])].sort((a, b) => a - b);
    const d = document.createElement('span');
    d.className = 'chip' + (i === activeIndex ? ' active' : '');
    d.textContent = all.length ? all.map(midiLetter).join(' ') : '–';
    d.title = `Step ${i + 1}: ${fmtBeats(s.beats)} beat(s)`;
    box.appendChild(d);
  });
}
let typingTimer = null;
function checkEditor() {
  const { steps: s, errors } = parseText($('notes').value);
  const st = $('notesStatus');
  if (errors.length) { st.className = 'err'; st.textContent = errors.slice(0, 6).join('\n'); }
  else { st.className = 'ok'; st.textContent = `${s.length} steps look good. Press "Load practice notes" to use them.`; renderLetters(s); }
}
$('notes').addEventListener('input', () => { clearTimeout(typingTimer); typingTimer = setTimeout(checkEditor, 250); });

$('apply').addEventListener('click', () => {
  const { steps: s, errors } = parseText($('notes').value);
  const st = $('notesStatus');
  if (errors.length) { st.className = 'err'; st.textContent = errors.slice(0, 6).join('\n'); return; }
  if (!s.length) { st.className = 'err'; st.textContent = 'There are no notes to load.'; return; }
  steps = s;
  stopPlayback();
  buildTimeline();
  renderLetters(steps);
  st.className = 'ok';
  st.textContent = `${steps.length} steps loaded. Scroll down to practice.`;
  setNow('Ready');
});

/* ---- Example songs ---- */
const EXAMPLES = {
  yahweh: {
    name: 'Yahweh – simple original melody (piano)',
    instrument: 'piano',
    text: `# Yahweh - simple original melody in C major, 4/4
1 | C3 G3 | E4
1 | - | G4
2 | - | C5
1 | A2 E3 | A4
1 | - | G4
2 | - | E4
1 | F2 C3 | F4
1 | - | A4
2 | - | C5
1 | G2 D3 | B4
1 | - | A4
2 | - | G4
1 | C3 G3 | E4
1 | - | G4
1 | - | C5
1 | - | D5
2 | F2 C3 | E5
1 | - | C5
1 | - | A4
1 | G2 D3 | B4
1 | - | A4
2 | - | G4
4 | C3 G3 | C5`
  },
  ode: {
    name: 'Ode to Joy – melody (guitar, letters)',
    instrument: 'guitar',
    text: `# Ode to Joy (Beethoven, public domain) - letters, guitar
1 | - | E4
1 | - | E4
1 | - | F4
1 | - | G4
1 | - | G4
1 | - | F4
1 | - | E4
1 | - | D4
1 | - | C4
1 | - | C4
1 | - | D4
1 | - | E4
1.5 | - | E4
0.5 | - | D4
2 | - | D4`
  },
  twinkle: {
    name: 'Twinkle Twinkle – guitar tab style (string/fret)',
    instrument: 'guitar',
    text: `# Twinkle Twinkle (public domain) - tab style string/fret
1 | - | 2/1
1 | - | 2/1
1 | - | 1/3
1 | - | 1/3
1 | - | 1/5
1 | - | 1/5
2 | - | 1/3
1 | - | 1/1
1 | - | 1/1
1 | - | 1/0
1 | - | 1/0
1 | - | 2/3
1 | - | 2/3
2 | - | 2/1`
  }
};
Object.entries(EXAMPLES).forEach(([key, ex]) => {
  const o = document.createElement('option'); o.value = key; o.textContent = ex.name;
  $('examples').appendChild(o);
});
$('loadExample').addEventListener('click', () => {
  const ex = EXAMPLES[$('examples').value];
  $('notes').value = ex.text;
  $('instrument').value = ex.instrument;
  updateInstrumentView();
  checkEditor();
  $('apply').click();
});

/* =====================  3. PRACTICE  ===================== */
/* ---- Piano keys ---- */
const keyEls = new Map();
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
function buildKeys() {
  const box = $('keys'); box.innerHTML = '';
  const whites = []; for (let m = 21; m <= 108; m++) if (!isBlack(m)) whites.push(m);
  const w = 100 / whites.length;
  whites.forEach(m => {
    const d = document.createElement('div');
    d.className = 'white';
    if (m % 12 === 0) d.textContent = 'C' + (m / 12 - 1);
    box.appendChild(d); keyEls.set(m, d);
  });
  let whiteCount = 0;
  for (let m = 21; m <= 108; m++) {
    if (!isBlack(m)) { whiteCount++; continue; }
    const d = document.createElement('div');
    d.className = 'black';
    d.style.left = (whiteCount * w - w * 0.3) + '%';
    d.style.width = (w * 0.6) + '%';
    box.appendChild(d); keyEls.set(m, d);
  }
}
function clearKeys() { keyEls.forEach(el => el.classList.remove('lh', 'rh', 'both')); }
function showKeys(left, right) {
  clearKeys();
  left.forEach(m => keyEls.get(m)?.classList.add('lh'));
  right.forEach(m => {
    const el = keyEls.get(m); if (!el) return;
    el.classList.remove('lh'); el.classList.add(left.includes(m) ? 'both' : 'rh');
  });
}

/* ---- Guitar fretboard ---- */
const FW = 52, SG = 30, LEFT = 44, TOP = 22;
const NS = 'http://www.w3.org/2000/svg';
let dotsGroup = null;
function svgEl(name, attrs, text) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}
function buildFretboard() {
  const svg = $('fretboard'), W = LEFT + FRETS * FW + 20, H = TOP + 5 * SG + 46;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  svg.appendChild(svgEl('rect', { x: LEFT, y: TOP - 8, width: FRETS * FW, height: 5 * SG + 16, fill: '#e9d8b8', rx: 4 }));
  for (let f = 0; f <= FRETS; f++)
    svg.appendChild(svgEl('line', { x1: LEFT + f * FW, y1: TOP - 8, x2: LEFT + f * FW, y2: TOP + 5 * SG + 8, stroke: f === 0 ? '#172334' : '#8c99a7', 'stroke-width': f === 0 ? 5 : 2 }));
  for (let s = 0; s < 6; s++) {
    svg.appendChild(svgEl('line', { x1: LEFT, y1: TOP + s * SG, x2: LEFT + FRETS * FW, y2: TOP + s * SG, stroke: '#555', 'stroke-width': 1 + s * 0.4 }));
    svg.appendChild(svgEl('text', { x: 14, y: TOP + s * SG + 5, 'font-size': 14, fill: '#536477', 'text-anchor': 'middle' }, `${s + 1} ${STRING_NAMES[s]}`));
  }
  for (let f = 1; f <= FRETS; f++) {
    svg.appendChild(svgEl('text', { x: LEFT + (f - 0.5) * FW, y: H - 22, 'font-size': 12, fill: '#536477', 'text-anchor': 'middle' }, f));
    if ([3, 5, 7, 9, 12, 15, 17].includes(f))
      svg.appendChild(svgEl('circle', { cx: LEFT + (f - 0.5) * FW, cy: H - 8, r: 3, fill: '#aab6c3' }));
  }
  dotsGroup = svgEl('g', {});
  svg.appendChild(dotsGroup);
}
const GUITAR_LOW = OPEN[5], GUITAR_HIGH = OPEN[0] + FRETS;
function guitarPositions(notes, usedInit = new Set()) {   // notes: [{midi, hand}]
  const used = new Set(usedInit), out = [];
  [...notes].sort((a, b) => b.midi - a.midi).forEach(n => {
    let m = n.midi;
    while (m < GUITAR_LOW) m += 12;
    while (m > GUITAR_HIGH) m -= 12;
    let best = null;
    OPEN.forEach((open, s) => {
      const fret = m - open;
      if (fret < 0 || fret > FRETS) return;
      const penalty = (used.has(s) ? 100 : 0) + fret;
      if (!best || penalty < best.penalty) best = { s, fret, penalty };
    });
    if (!best) return;
    used.add(best.s);
    out.push({ midi: m, string: best.s, fret: best.fret, hand: n.hand });
  });
  return out;
}
function showGuitar(positions) {
  dotsGroup.innerHTML = '';
  positions.forEach(p => {
    const x = p.fret === 0 ? LEFT - 18 : LEFT + (p.fret - 0.5) * FW, y = TOP + p.string * SG;
    dotsGroup.appendChild(svgEl('circle', { cx: x, cy: y, r: 12, fill: HAND_COLOR[p.hand] }));
    dotsGroup.appendChild(svgEl('text', { x, y: y + 4, 'font-size': 11, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle' }, midiLetter(p.midi)));
  });
}

/* ---- Sound: real samples (smplr) with synth fallback ---- */
const SMPLR_URL = 'https://unpkg.com/smplr@0.16.4/dist/index.mjs';
let audio = null, smplr = null;
const bank = {}, loadingBank = {};
const setSoundStatus = t => { $('soundStatus').textContent = t; };

function ensureAudio() {
  if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
  if (audio && audio.state === 'suspended') audio.resume();
}
function loadInstrument(kind) {
  if (bank[kind]) return Promise.resolve(bank[kind]);
  if (loadingBank[kind]) return loadingBank[kind];
  loadingBank[kind] = (async () => {
    try {
      ensureAudio();
      setSoundStatus(`Loading real ${kind} sound… (needs internet, a few seconds)`);
      if (!smplr) smplr = await import(SMPLR_URL);
      const inst = kind === 'piano'
        ? new smplr.SplendidGrandPiano(audio)
        : new smplr.Soundfont(audio, { instrument: 'acoustic_guitar_nylon' });
      await inst.load;
      bank[kind] = inst;
      setSoundStatus(`Real ${kind} sound ready.`);
    } catch (err) {
      bank[kind] = 'fail';
      setSoundStatus('Real sounds could not be loaded (check internet). Using simple synth tones.');
    }
    return bank[kind];
  })();
  return loadingBank[kind];
}
function synth(midi, dur, kind, delay) {
  const t = audio.currentTime + delay, f = 440 * Math.pow(2, (midi - 69) / 12);
  const o = audio.createOscillator(), g = audio.createGain();
  let len;
  g.gain.setValueAtTime(0.0001, t);
  if (kind === 'guitar') {
    o.type = 'sawtooth';
    const lp = audio.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f * 7, 6000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 250), t + 0.6);
    o.connect(lp); lp.connect(g);
    len = Math.min(Math.max(dur, 0.4) * 1.2, 2.5);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
  } else {
    o.type = 'triangle'; o.connect(g);
    len = Math.min(dur * 1.1 + 0.4, 3);
    g.gain.linearRampToValueAtTime(0.22, t + 0.01);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.frequency.value = f;
  g.connect(audio.destination);
  o.start(t); o.stop(t + len + 0.05);
}
function tone(midi, dur, kind, delay = 0) {
  if (!audio || !$('sound').checked) return;
  const inst = bank[kind];
  if (inst && inst !== 'fail') {
    inst.start({
      note: midi, velocity: kind === 'piano' ? 85 : 95,
      time: audio.currentTime + delay,
      duration: kind === 'piano' ? Math.max(dur * 1.1, 0.3) : Math.max(dur * 1.6, 0.8)
    });
  } else synth(midi, dur, kind, delay);
}

/* ---- Timeline & playback ---- */
let idx = 0, playing = false, starting = false, timer = null, countTimer = null;
const setNow = t => { $('now').textContent = t; };
const instrument = () => $('instrument').value;

function stepNotes(i) {
  const s = steps[i], h = $('hand').value;
  return { left: h === 'right' ? [] : s.left, right: h === 'left' ? [] : s.right };
}
function stepLabel(i) {
  const { left, right } = stepNotes(i);
  const parts = [];
  if (left.length) parts.push('L: ' + left.map(midiName).join(' '));
  if (right.length) parts.push('R: ' + right.map(midiName).join(' '));
  return parts.join('  ') || 'Rest';
}
function buildTimeline() {
  const tl = $('timeline'); tl.innerHTML = '';
  steps.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'event';
    d.textContent = `${i + 1}. ${stepLabel(i)} (${fmtBeats(s.beats)})`;
    tl.appendChild(d);
  });
}
function clearDisplay() { clearKeys(); if (dotsGroup) dotsGroup.innerHTML = ''; }

function showStep(i, ms) {
  const { left, right } = stepNotes(i);
  [...$('timeline').children].forEach((el, k) => el.classList.toggle('active', k === i));
  $('timeline').children[i]?.scrollIntoView({ inline: 'center', block: 'nearest' });
  renderLetters(steps, i);
  setNow(stepLabel(i));
  const dur = ms / 1000;
  if (instrument() === 'piano') {
    showKeys(left, right);
    [...new Set([...left, ...right])].forEach(m => tone(m, dur, 'piano'));
  } else {
    const all = left.map(m => ({ midi: m, hand: 'left' }));
    right.forEach(m => {
      const e = all.find(x => x.midi === m);
      if (e) e.hand = 'both'; else all.push({ midi: m, hand: 'right' });
    });
    const tabs = steps[i].tabs || {}, fixed = [], auto = [], used = new Set();
    all.forEach(n => {
      const t = tabs[n.midi];
      if (t) { fixed.push({ midi: n.midi, string: t.string, fret: t.fret, hand: n.hand }); used.add(t.string); }
      else auto.push(n);
    });
    const pos = [...fixed, ...guitarPositions(auto, used)];
    showGuitar(pos);
    pos.sort((a, b) => b.string - a.string).forEach((p, k) => tone(p.midi, dur, 'guitar', k * 0.025)); // tiny strum
  }
}
function stepMs(i) {
  const bpm = Math.min(300, Math.max(20, +$('bpm').value || 80));
  return steps[i].beats * 60000 / (bpm * (+$('speed').value / 100));
}
function tick() {
  if (!playing) return;
  if (idx >= steps.length) { stopPlayback(); setNow('Finished'); return; }
  const ms = stepMs(idx);
  showStep(idx, ms);
  timer = setTimeout(() => { idx++; tick(); }, ms);
}
async function startPlayback() {
  if (!steps.length) { setNow('Press "Load practice notes" first (step 2).'); return; }
  if (playing || starting) return;
  ensureAudio();
  if ($('sound').checked) {
    starting = true; setNow('Loading sound…');
    await loadInstrument(instrument());
    starting = false;
  }
  playing = true;
  if (idx >= steps.length) idx = 0;
  const cd = idx === 0 ? Math.max(0, Math.floor(+$('count').value || 0)) : 0;
  if (cd > 0) {
    let n = cd;
    const run = () => {
      if (!playing) return;
      if (n <= 0) { tick(); return; }
      setNow('Starting in ' + n); n--;
      countTimer = setTimeout(run, 1000);
    };
    run();
  } else tick();
}
function pausePlayback() {
  playing = false;
  clearTimeout(timer); clearTimeout(countTimer);
  if (steps.length) setNow('Paused');
}
function stopPlayback() {
  playing = false; idx = 0;
  clearTimeout(timer); clearTimeout(countTimer);
  clearDisplay();
  [...$('timeline').children].forEach(el => el.classList.remove('active'));
  if (steps.length) renderLetters(steps);
  setNow('Ready');
}
function updateInstrumentView() {
  const g = instrument() === 'guitar';
  $('guitarView').hidden = !g;
  $('pianoView').hidden = g;
  clearDisplay();
}

$('play').addEventListener('click', startPlayback);
$('pause').addEventListener('click', pausePlayback);
$('stop').addEventListener('click', stopPlayback);
$('speed').addEventListener('input', () => { $('speedText').textContent = $('speed').value + '%'; });
$('hand').addEventListener('change', () => { if (steps.length) buildTimeline(); });
$('instrument').addEventListener('change', () => {
  updateInstrumentView();
  if ($('sound').checked) loadInstrument(instrument());   // preload samples
});

/* ---- Start ---- */
buildKeys();
buildFretboard();
checkEditor();
$('apply').click();