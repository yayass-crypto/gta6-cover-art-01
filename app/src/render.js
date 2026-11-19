// Neon Coast Cover Maker — pure cover renderer.
// drawCover(ctx, state, W, H) paints one GTA-style multi-panel poster cover
// onto any 2D canvas context. No DOM, no network, no side effects.

export const LAYOUTS = [
  { id: 'hero-duo', name: 'Hero + Duo', panels: 3 },
  { id: 'four-up', name: 'Four-Up', panels: 4 },
  { id: 'hero-strip', name: 'Hero + Strip', panels: 4 },
  { id: 'triptych', name: 'Triptych', panels: 3 },
];

export const GRADES = ['sunset', 'neon', 'noir'];

export const SIZES = [
  { id: '1080x1080', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Landscape · 1920 × 1080', w: 1920, h: 1080 },
];

// Panel rects for each layout, in fractions of the cover (inside the frame).
// Returns an array of {x, y, w, h} in pixels for the given cover size.
export function layoutPanels(layout, W, H) {
  const g = Math.max(6, Math.round(Math.min(W, H) * 0.008)); // white gutter
  const f = Math.round(Math.min(W, H) * 0.014); // outer frame inset
  const x0 = f, y0 = f, x1 = W - f, y1 = H - f;
  const cw = x1 - x0, ch = y1 - y0;
  if (layout === 1) {
    // Four-up: 2x2 grid.
    const pw = (cw - g) / 2, ph = (ch - g) / 2;
    return [
      { x: x0, y: y0, w: pw, h: ph },
      { x: x0 + pw + g, y: y0, w: pw, h: ph },
      { x: x0, y: y0 + ph + g, w: pw, h: ph },
      { x: x0 + pw + g, y: y0 + ph + g, w: pw, h: ph },
    ];
  }
  if (layout === 2) {
    // Hero + strip: big top hero, three small panels below.
    const heroH = ch * 0.62;
    const stripH = ch - heroH - g;
    const pw = (cw - 2 * g) / 3;
    return [
      { x: x0, y: y0, w: cw, h: heroH },
      { x: x0, y: y0 + heroH + g, w: pw, h: stripH },
      { x: x0 + pw + g, y: y0 + heroH + g, w: pw, h: stripH },
      { x: x0 + 2 * (pw + g), y: y0 + heroH + g, w: pw, h: stripH },
    ];
  }
  if (layout === 3) {
    // Triptych: three tall panels — wide centre hero, narrow wings.
    const sideW = cw * 0.24;
    const midW = cw - 2 * sideW - 2 * g;
    return [
      { x: x0, y: y0, w: sideW, h: ch },
      { x: x0 + sideW + g, y: y0, w: midW, h: ch },
      { x: x0 + sideW + g + midW + g, y: y0, w: sideW, h: ch },
    ];
  }
  // Layout 0 — Hero + duo: big left hero, two stacked panels on the right.
  const heroW = cw * 0.62;
  const sideW = cw - heroW - g;
  const ph = (ch - g) / 2;
  return [
    { x: x0, y: y0, w: heroW, h: ch },
    { x: x0 + heroW + g, y: y0, w: sideW, h: ph },
    { x: x0 + heroW + g, y: y0 + ph + g, w: sideW, h: ph },
  ];
}

// Which photo index feeds each panel. With onePhoto, every panel uses photo 0.
export function panelPhotoIndexes(layout, photoCount, onePhoto) {
  const n = LAYOUTS[layout].panels;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (onePhoto || photoCount === 0) out.push(0);
    else out.push(i % photoCount);
  }
  return out;
}

// Draw one photo into a panel rect, cover-fit (or contain) with pan + zoom.
// photo: { img, ox, oy, zoom, fit } — ox/oy are pan fractions (-1..1).
function drawPhotoInto(ctx, photo, rect) {
  const img = photo.img;
  if (!img || !img.naturalWidth) return false;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const pr = rect.w / rect.h, ir = iw / ih;
  let dw, dh;
  if (photo.fit === 'contain') {
    if (ir > pr) { dw = rect.w; dh = rect.w / ir; } else { dh = rect.h; dw = rect.h * ir; }
  } else {
    if (ir > pr) { dh = rect.h; dw = rect.h * ir; } else { dw = rect.w; dh = rect.w / ir; }
  }
  const z = Math.max(0.5, Math.min(4, photo.zoom || 1));
  dw *= z; dh *= z;
  const cx = rect.x + rect.w / 2 + (photo.ox || 0) * rect.w * 0.4;
  const cy = rect.y + rect.h / 2 + (photo.oy || 0) * rect.h * 0.4;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  return true;
}

// Fallback art when a panel has no photo yet: a stylised sunset skyline.
function drawPlaceholder(ctx, rect, grade, seed) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (grade === 'noir') {
    g.addColorStop(0, '#3a3a40'); g.addColorStop(0.6, '#17171a'); g.addColorStop(1, '#050506');
  } else if (grade === 'neon') {
    g.addColorStop(0, '#2b0a4d'); g.addColorStop(0.55, '#7a0f6e'); g.addColorStop(1, '#0a0a2e');
  } else {
    g.addColorStop(0, '#ff9a3d'); g.addColorStop(0.5, '#ff5e7a'); g.addColorStop(1, '#5b2a86');
  }
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Sun disc.
  const sx = rect.x + rect.w * (0.3 + 0.4 * ((seed * 37) % 10) / 10);
  const sy = rect.y + rect.h * 0.32;
  const sr = Math.min(rect.w, rect.h) * 0.16;
  const sg = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr);
  sg.addColorStop(0, 'rgba(255,244,200,0.95)');
  sg.addColorStop(0.55, 'rgba(255,180,90,0.75)');
  sg.addColorStop(1, 'rgba(255,120,80,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // Skyline blocks.
  ctx.fillStyle = 'rgba(10,6,18,0.85)';
  let bx = rect.x;
  const base = rect.y + rect.h * 0.78;
  while (bx < rect.x + rect.w) {
    const bw = rect.w * (0.08 + 0.05 * (((seed + bx) % 7) / 7));
    const bh = rect.h * (0.1 + 0.16 * (((seed * 3 + bx) % 5) / 5));
    ctx.fillRect(bx, base - bh, bw, bh + rect.h * 0.22);
    bx += bw + rect.w * 0.02;
  }
  // Hint text.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.max(12, rect.h * 0.045)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h * 0.55);
}

// Grade overlays, drawn over the whole cover (clipped to the frame).
function applyGrade(ctx, grade, W, H, frame) {
  const { x, y, w, h } = frame;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (grade === 'sunset') {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255,140,50,0.16)');
    g.addColorStop(0.45, 'rgba(255,80,110,0.20)');
    g.addColorStop(1, 'rgba(110,40,170,0.26)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const warm = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
    warm.addColorStop(0, 'rgba(255,110,40,0)');
    warm.addColorStop(1, 'rgba(255,90,30,0.14)');
    ctx.fillStyle = warm; ctx.fillRect(x, y, w, h);
  } else if (grade === 'neon') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,0,170,0.20)');
    g.addColorStop(0.5, 'rgba(0,220,255,0.14)');
    g.addColorStop(1, 'rgba(140,0,255,0.22)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    // Neon edge glow: alternating magenta / cyan strokes along the frame.
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.shadowBlur = Math.max(12, W * 0.012);
    ctx.shadowColor = '#ff00aa';
    ctx.strokeStyle = 'rgba(255,0,170,0.85)';
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.shadowColor = '#00dcff';
    ctx.strokeStyle = 'rgba(0,220,255,0.7)';
    ctx.strokeRect(x + W * 0.004, y + W * 0.004, w - W * 0.008, h - W * 0.008);
    ctx.shadowBlur = 0;
  } else {
    // Noir: cool desaturated wash + heavy vignette handled below.
    ctx.fillStyle = 'rgba(20,24,40,0.18)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Halftone dot overlay, cached per size.
const halftoneCache = new Map();
function halftonePattern(size) {
  const key = size;
  if (halftoneCache.has(key)) return halftoneCache.get(key);
  const s = Math.max(6, Math.round(size / 90));
  const tile = document.createElement('canvas');
  tile.width = tile.height = s * 2;
  const t = tile.getContext('2d');
  t.fillStyle = 'rgba(0,0,0,0.55)';
  t.beginPath(); t.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2); t.fill();
  t.beginPath(); t.arc(s * 1.5, s * 1.5, s * 0.22, 0, Math.PI * 2); t.fill();
  const pat = tile;
  halftoneCache.set(key, pat);
  return pat;
}

// Film grain, cached per size (seeded noise tile).
const grainCache = new Map();
function grainTile(size) {
  if (grainCache.has(size)) return grainCache.get(size);
  const t = document.createElement('canvas');
  t.width = t.height = 128;
  const c = t.getContext('2d');
  const img = c.createImageData(128, 128);
  let seed = 1234567 + size;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainCache.set(size, t);
  return t;
}

// Vignette: darken the edges of the whole cover.
function applyVignette(ctx, W, H, strength) {
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Big bold caption with outline + drop shadow + gradient fill.
// Returns the font size used (for the subtitle placement).
function drawCaption(ctx, caption, subtitle, W, H, grade) {
  const bandH = H * 0.24;
  const bandY = H - bandH;
  // Legibility gradient at the bottom.
  const bg = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(0.55, 'rgba(0,0,0,0.42)');
  bg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY - H * 0.06, W, H - bandY + H * 0.06);

  const text = (caption || 'NEON COAST').toUpperCase().slice(0, 40);
  const maxW = W * 0.92;
  let fs = H * 0.135;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `${s}px Anton, "Arial Black", "Archivo Black", sans-serif`; };
  setFont(fs);
  while (fs > H * 0.04 && ctx.measureText(text).width > maxW) {
    fs *= 0.94;
    setFont(fs);
  }
  const cx = W / 2;
  const cy = H - H * 0.055;
  // Gradient fill per grade.
  const fg = ctx.createLinearGradient(0, cy - fs, 0, cy + fs * 0.12);
  if (grade === 'sunset') {
    fg.addColorStop(0, '#fff7d6'); fg.addColorStop(0.45, '#ffd23e'); fg.addColorStop(1, '#ff5e3a');
  } else if (grade === 'neon') {
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.5, '#7df9ff'); fg.addColorStop(1, '#ff4fd8');
  } else {
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#d8d8de');
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = fs * 0.06;
  ctx.shadowOffsetY = fs * 0.045;
  ctx.strokeStyle = '#0a0a0f';
  ctx.lineWidth = Math.max(3, fs * 0.085);
  ctx.strokeText(text, cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = fg;
  ctx.fillText(text, cx, cy);
  // Thin bright inner highlight along the top of the letters.
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1.5, fs * 0.012);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(text, cx, cy - fs * 0.02);
  ctx.restore();

  // Subtitle, letter-spaced small caps above the caption.
  const sub = (subtitle || 'A SOLMAR STORY').toUpperCase().slice(0, 60);
  if (sub) {
    const sfs = Math.max(13, H * 0.026);
    ctx.font = `700 ${sfs}px system-ui, "Segoe UI", sans-serif`;
    const spaced = sub.split('').join('\u2009\u2009');
    const sw = ctx.measureText(spaced).width;
    const sx = cx - sw / 2;
    const sy = cy - fs * 1.08;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = sfs * 0.25;
    ctx.shadowOffsetY = sfs * 0.08;
    ctx.fillStyle = grade === 'noir' ? '#e8e8ec' : '#ffe9a8';
    ctx.textAlign = 'left';
    ctx.fillText(spaced, sx, sy);
    ctx.restore();
  }
  return fs;
}

// Sunset sun disc glowing in the hero panel (grade sunset only).
// Small, tucked into the hero panel's upper corner so it never covers a face.
function drawSun(ctx, heroRect, W) {
  const sx = heroRect.x + heroRect.w * 0.86;
  const sy = heroRect.y + heroRect.h * 0.13;
  const sr = Math.min(heroRect.w, heroRect.h) * 0.085;
  ctx.save();
  ctx.beginPath(); ctx.rect(heroRect.x, heroRect.y, heroRect.w, heroRect.h); ctx.clip();
  const g = ctx.createRadialGradient(sx, sy, sr * 0.05, sx, sy, sr * 1.9);
  g.addColorStop(0, 'rgba(255,220,120,0.7)');
  g.addColorStop(0.3, 'rgba(255,150,70,0.35)');
  g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(sx, sy, sr * 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  core.addColorStop(0, '#fff6cf');
  core.addColorStop(0.7, '#ffb347');
  core.addColorStop(1, '#ff7a3d');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Main entry: paint the whole cover.
// state: { layout, grade, halftone, grain, caption, subtitle, photos, onePhoto }
export function drawCover(ctx, state, W, H) {
  const grade = state.grade || 'sunset';
  const layout = state.layout || 0;
  const photos = state.photos || [];

  // Paper-white background = the gutters + outer frame.
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, W, H);

  const f = Math.round(Math.min(W, H) * 0.014);
  const frame = { x: f, y: f, w: W - 2 * f, h: H - 2 * f };
  const panels = layoutPanels(layout, W, H);
  const indexes = panelPhotoIndexes(layout, photos.length, state.onePhoto);

  panels.forEach((rect, i) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    const photo = photos[indexes[i]];
    let painted = false;
    if (photo && photo.img) {
      // Per-grade photo filter.
      if (grade === 'sunset') ctx.filter = 'saturate(1.3) contrast(1.06) brightness(1.02)';
      else if (grade === 'neon') ctx.filter = 'saturate(1.65) contrast(1.28) brightness(1.0)';
      else ctx.filter = 'grayscale(1) contrast(1.18) brightness(0.96)';
      painted = drawPhotoInto(ctx, photo, rect);
      ctx.filter = 'none';
    }
    if (!painted) drawPlaceholder(ctx, rect, grade, i + 1);
    ctx.restore();
  });

  // Sunset sun over the hero panel.
  if (grade === 'sunset' && panels[0]) drawSun(ctx, panels[0], W);

  applyGrade(ctx, grade, W, H, frame);

  if (state.halftone) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(halftonePattern(Math.min(W, H)), 'repeat');
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainTile(Math.min(W, H)), 'repeat');
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
  }

  applyVignette(ctx, W, H, grade === 'noir' ? 0.55 : grade === 'neon' ? 0.3 : 0.38);

  // Thin black outer frame line.
  ctx.strokeStyle = '#0a0a0f';
  ctx.lineWidth = Math.max(2, W * 0.002);
  ctx.strokeRect(f / 2, f / 2, W - f, H - f);

  drawCaption(ctx, state.caption, state.subtitle, W, H, grade);
  ctx.restore();
}
