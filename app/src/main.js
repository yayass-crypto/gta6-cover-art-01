// Neon Coast Cover Maker — editor state, UI wiring, export and ?shot= staging.
import { drawCover, layoutPanels, LAYOUTS, GRADES, SIZES } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

const state = {
  layout: 0,
  grade: 'sunset',
  size: '1920x1080',
  halftone: true,
  grain: true,
  caption: 'NEON COAST',
  subtitle: 'A Solmar Story',
  onePhoto: false,
  photos: [], // { img, name, ox, oy, zoom, fit }
  selected: 0, // selected panel index
};

const SAMPLES = [
  { name: 'boulevard', file: 'samples/boulevard.jpg', label: 'Boulevard' },
  { name: 'pier', file: 'samples/pier.jpg', label: 'Pier' },
];

let fontsReady = false;
let paintQueued = false;

function currentSize() {
  return SIZES.find((s) => s.id === state.size) || SIZES[2];
}

function paint() {
  const { w, h } = currentSize();
  canvas.width = w;
  canvas.height = h;
  drawCover(ctx, state, w, h);
  paintQueued = false;
}

function requestPaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(paint);
}

function selectedPhoto() {
  const panels = layoutPanels(state.layout, 1, 1);
  void panels;
  const n = LAYOUTS[state.layout].panels;
  const idx = state.onePhoto ? 0 : (state.selected % Math.max(1, state.photos.length || 1));
  return state.photos.length ? state.photos[Math.min(idx, state.photos.length - 1)] : null;
}

function refreshUI() {
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.classList.toggle('active', Number(b.dataset.layout) === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) =>
    b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) =>
    b.classList.toggle('active', b.dataset.size === state.size));
  $('halftone').checked = state.halftone;
  $('grain').checked = state.grain;
  $('onePhoto').checked = state.onePhoto;
  $('captionInput').value = state.caption;
  $('subtitleInput').value = state.subtitle;
  const p = selectedPhoto();
  $('zoom').value = p ? String(Math.round((p.zoom || 1) * 100)) : '100';
  $('zoomVal').textContent = (p ? Math.round((p.zoom || 1) * 100) : 100) + '%';
  $('fitToggle').textContent = p && p.fit === 'contain' ? 'Fit: Contain' : 'Fit: Fill';
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${LAYOUTS[state.layout].panels}`;
  renderThumbs();
  updateSizeNote();
}

function updateSizeNote() {
  const { w, h } = currentSize();
  $('sizeNote').textContent = `Preview ${w} × ${h} — export downloads a full-resolution PNG.`;
}

function renderThumbs() {
  const wrap = $('thumbs');
  wrap.innerHTML = '';
  if (!state.photos.length) {
    wrap.innerHTML = '<p class="hint">No photos yet — load a sample or drop your own in.</p>';
    return;
  }
  state.photos.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'thumb' + (i === 0 && state.onePhoto ? ' fills-all' : '');
    const img = document.createElement('img');
    img.src = p.img.src;
    img.alt = p.name;
    const lab = document.createElement('span');
    lab.textContent = `${i + 1} · ${p.name}`;
    const rm = document.createElement('button');
    rm.className = 'thumb-remove';
    rm.textContent = '×';
    rm.title = 'Remove photo';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      state.photos.splice(i, 1);
      if (state.selected >= LAYOUTS[state.layout].panels) state.selected = 0;
      refreshUI(); requestPaint();
    });
    d.append(img, lab, rm);
    d.addEventListener('click', () => {
      // Click a thumbnail to assign it to the selected panel's slot.
      state.selected = i % LAYOUTS[state.layout].panels;
      refreshUI(); requestPaint();
    });
    wrap.appendChild(d);
  });
}

function loadImage(src, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, name, ox: 0, oy: 0, zoom: 1, fit: 'fill' });
    img.onerror = () => reject(new Error('Could not load image: ' + name));
    img.src = src;
  });
}

async function addPhotos(files) {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  for (const f of list) {
    if (state.photos.length >= 4) break;
    try {
      const url = URL.createObjectURL(f);
      const photo = await loadImage(url, f.name.replace(/\.[^.]+$/, '').slice(0, 24));
      state.photos.push(photo);
    } catch (e) { console.warn(e); }
  }
  refreshUI(); requestPaint();
}

async function loadSample(name) {
  const s = SAMPLES.find((x) => x.name === name);
  if (!s) return;
  try {
    const photo = await loadImage(s.file, s.label);
    if (state.photos.length >= 4) state.photos.shift();
    state.photos.push(photo);
    refreshUI(); requestPaint();
  } catch (e) { console.warn(e); }
}

// ---- Export ----
function exportPNG() {
  const { w, h } = currentSize();
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawCover(off.getContext('2d'), state, w, h);
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

// ---- Pan by dragging on the preview ----
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  return { x, y };
}
function panelAt(x, y) {
  const { w, h } = currentSize();
  const panels = layoutPanels(state.layout, w, h);
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (x >= p.x / w && x <= (p.x + p.w) / w && y >= p.y / h && y <= (p.y + p.h) / h) return i;
  }
  return 0;
}
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  state.selected = panelAt(pt.x, pt.y);
  const p = selectedPhoto();
  drag = { x: pt.x, y: pt.y, photo: p };
  canvas.setPointerCapture(e.pointerId);
  refreshUI();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || !drag.photo) return;
  const pt = canvasPoint(e);
  const dx = pt.x - drag.x, dy = pt.y - drag.y;
  drag.photo.ox = Math.max(-1, Math.min(1, drag.photo.ox + dx * 1.6));
  drag.photo.oy = Math.max(-1, Math.min(1, drag.photo.oy + dy * 1.6));
  drag.x = pt.x; drag.y = pt.y;
  requestPaint();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// ---- Controls ----
document.querySelectorAll('[data-layout]').forEach((b) =>
  b.addEventListener('click', () => { state.layout = Number(b.dataset.layout); state.selected = 0; refreshUI(); requestPaint(); }));
document.querySelectorAll('[data-grade]').forEach((b) =>
  b.addEventListener('click', () => { state.grade = b.dataset.grade; refreshUI(); requestPaint(); }));
document.querySelectorAll('[data-size]').forEach((b) =>
  b.addEventListener('click', () => { state.size = b.dataset.size; refreshUI(); requestPaint(); }));
$('halftone').addEventListener('change', (e) => { state.halftone = e.target.checked; requestPaint(); });
$('grain').addEventListener('change', (e) => { state.grain = e.target.checked; requestPaint(); });
$('onePhoto').addEventListener('change', (e) => { state.onePhoto = e.target.checked; refreshUI(); requestPaint(); });
$('captionInput').addEventListener('input', (e) => { state.caption = e.target.value; requestPaint(); });
$('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; requestPaint(); });
$('zoom').addEventListener('input', (e) => {
  const p = selectedPhoto();
  if (p) { p.zoom = Number(e.target.value) / 100; $('zoomVal').textContent = e.target.value + '%'; requestPaint(); }
});
$('fitToggle').addEventListener('click', () => {
  const p = selectedPhoto();
  if (p) { p.fit = p.fit === 'contain' ? 'fill' : 'contain'; refreshUI(); requestPaint(); }
});
$('exportBtn').addEventListener('click', exportPNG);
$('fileInput').addEventListener('change', (e) => { addPhotos(e.target.files); e.target.value = ''; });
document.querySelectorAll('[data-sample]').forEach((b) =>
  b.addEventListener('click', () => loadSample(b.dataset.sample)));
$('dropzone').addEventListener('click', () => $('fileInput').click());
['dragover', 'dragenter'].forEach((ev) => $('dropzone').addEventListener(ev, (e) => { e.preventDefault(); $('dropzone').classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => $('dropzone').addEventListener(ev, (e) => { e.preventDefault(); $('dropzone').classList.remove('over'); }));
$('dropzone').addEventListener('drop', (e) => addPhotos(e.dataTransfer.files));

// ---- ?shot= staging ----
function shotParams() {
  const q = new URLSearchParams(location.search);
  return {
    shot: q.get('shot'),
    photo: q.get('photo'),
    caption: q.get('caption'),
    subtitle: q.get('subtitle'),
    size: q.get('size'),
    layout: q.get('layout'),
    grade: q.get('grade'),
  };
}

async function boot() {
  const q = shotParams();
  if (q.caption) state.caption = q.caption.slice(0, 40);
  if (q.subtitle) state.subtitle = q.subtitle.slice(0, 60);
  if (q.size && SIZES.some((s) => s.id === q.size)) state.size = q.size;
  if (q.layout !== null && q.layout !== undefined && LAYOUTS[Number(q.layout)]) state.layout = Number(q.layout);
  if (q.grade && GRADES.includes(q.grade)) state.grade = q.grade;

  const photoName = q.photo || 'boulevard';
  if (q.shot === 'cover' || q.shot === 'editor') {
    document.body.classList.add(q.shot === 'cover' ? 'shot-cover' : 'shot-editor');
    // Cover staging: load both samples so every panel has a photo.
    await loadSample('boulevard');
    await loadSample('pier');
    if (photoName === 'pier' && state.photos.length > 1) {
      // Put pier first so the hero panel shows it.
      const [b, p] = state.photos;
      state.photos = [p, b];
    }
    state.onePhoto = false;
  }

  refreshUI();
  // Wait for the display font so the caption paints in Anton, not a fallback.
  try {
    await Promise.race([
      document.fonts.load('100px Anton').then(() => { fontsReady = true; }),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }
  paint();
  window.__shotReady = true;
  window.__ready = true;
}

boot();
