// Neon Coast Cover Maker — the cover painter.
//
// drawCover(ctx, state, W, H) paints one GTA-style multi-panel poster
// cover onto any 2D canvas. Pure drawing: no DOM reads, no network,
// no side effects beyond the canvas it is handed.

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

// Panel rectangles for a layout, as fractions of the cover inside its frame.
// Each entry is {x, y, w, h} in pixels for the requested cover size.
export function layoutPanels(layout, W, H) {
  const gap = Math.max(6, Math.round(Math.min(W, H) * 0.008)); // white gutter
  const edge = Math.round(Math.min(W, H) * 0.014); // outer frame inset
  const left = edge, top = edge;
  const wide = W - 2 * edge, tall = H - 2 * edge;
  if (layout === 1) {
    // Four-Up: an even 2 by 2 grid.
    const pw = (wide - gap) / 2, ph = (tall - gap) / 2;
    return [
      { x: left, y: top, w: pw, h: ph },
      { x: left + pw + gap, y: top, w: pw, h: ph },
      { x: left, y: top + ph + gap, w: pw, h: ph },
      { x: left + pw + gap, y: top + ph + gap, w: pw, h: ph },
    ];
  }
  if (layout === 2) {
    // Hero + Strip: one big panel on top, three small ones below it.
    const heroH = tall * 0.62;
    const stripH = tall - heroH - gap;
    const pw = (wide - 2 * gap) / 3;
    return [
      { x: left, y: top, w: wide, h: heroH },
      { x: left, y: top + heroH + gap, w: pw, h: stripH },
      { x: left + pw + gap, y: top + heroH + gap, w: pw, h: stripH },
      { x: left + 2 * (pw + gap), y: top + heroH + gap, w: pw, h: stripH },
    ];
  }
  if (layout === 3) {
    // Triptych: a wide centre hero with narrow wings on both sides.
    const wingW = wide * 0.24;
    const midW = wide - 2 * wingW - 2 * gap;
    return [
      { x: left, y: top, w: wingW, h: tall },
      { x: left + wingW + gap, y: top, w: midW, h: tall },
      { x: left + wingW + gap + midW + gap, y: top, w: wingW, h: tall },
    ];
  }
  // Layout 0 — Hero + Duo: a big hero on the left, two stacked on the right.
  const heroW = wide * 0.62;
  const sideW = wide - heroW - gap;
  const ph = (tall - gap) / 2;
  return [
    { x: left, y: top, w: heroW, h: tall },
    { x: left + heroW + gap, y: top, w: sideW, h: ph },
    { x: left + heroW + gap, y: top + ph + gap, w: sideW, h: ph },
  ];
}

// Which photo feeds each panel. With onePhoto on, every panel uses photo 0;
// otherwise panels cycle through the loaded photos in order.
export function panelPhotoIndexes(layout, photoCount, onePhoto) {
  const count = LAYOUTS[layout].panels;
  const out = [];
  for (let i = 0; i < count; i++) {
    if (onePhoto || photoCount === 0) out.push(0);
    else out.push(i % photoCount);
  }
  return out;
}

// Framing bias for wide, short panels: they show only a thin band of a
// portrait photo, and the band defaults to the photo's vertical middle —
// which cuts a face in half. Portraits usually keep their subject in the
// upper half, so unless the user has panned the photo themselves, aim the
// band's centre at about 38% of the photo's height. The pan offset moves
// the image down (positive oy shows the photo's upper part), and the
// offset needed grows with how much taller the drawn photo is than the
// panel, so it is computed from the cover-fit size, not fixed.
function upperThirdBias(photo, rect) {
  if (rect.w / rect.h <= 1.15 || (photo.oy || 0) !== 0) return 0;
  const img = photo.img;
  if (!img || !img.naturalWidth) return 0;
  const panelRatio = rect.w / rect.h;
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const drawnH = imgRatio > panelRatio ? rect.h : rect.w / imgRatio;
  return Math.max(-1, Math.min(1, 0.3 * (drawnH / rect.h)));
}

// Framing for one panel when its photo appears more than once on the cover.
// The first showing stays centred (the user's own pan); each repeat looks
// at a different third of the photo — left, then right, then low, then high
// — so a repeated panel never shows the identical crop. Offsets are pan
// fractions in the same -1..1 range the editor stores per photo.
export function panelCropOffset(repeatIndex) {
  const table = [
    { ox: 0, oy: 0 },
    { ox: -0.55, oy: 0.12 },
    { ox: 0.55, oy: -0.12 },
    { ox: -0.3, oy: 0.3 },
    { ox: 0.3, oy: -0.3 },
  ];
  return table[repeatIndex % table.length];
}

// Paint one photo into a panel rectangle, cover-fit (or contain) with the
// photo's pan and zoom. photo is { img, ox, oy, zoom, fit }.
function drawPhotoInto(ctx, photo, rect) {
  const img = photo.img;
  if (!img || !img.naturalWidth) return false;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const panelRatio = rect.w / rect.h, imgRatio = iw / ih;
  let dw, dh;
  if (photo.fit === 'contain') {
    if (imgRatio > panelRatio) { dw = rect.w; dh = rect.w / imgRatio; }
    else { dh = rect.h; dw = rect.h * imgRatio; }
  } else {
    if (imgRatio > panelRatio) { dh = rect.h; dw = rect.h * imgRatio; }
    else { dw = rect.w; dh = rect.w / imgRatio; }
  }
  const zoom = Math.max(0.5, Math.min(4, photo.zoom || 1));
  dw *= zoom; dh *= zoom;
  const cx = rect.x + rect.w / 2 + (photo.ox || 0) * rect.w * 0.4;
  const cy = rect.y + rect.h / 2 + (photo.oy || 0) * rect.h * 0.4;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  return true;
}

// Stand-in art for a panel with no photo yet: a stylised sunset skyline.
// The glowing disc here is part of the drawn sky — there is no photo and
// no face underneath it, so it cannot land on anyone.
function drawPlaceholder(ctx, rect, grade, seed) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (grade === 'noir') {
    sky.addColorStop(0, '#3a3a40'); sky.addColorStop(0.6, '#17171a'); sky.addColorStop(1, '#050506');
  } else if (grade === 'neon') {
    sky.addColorStop(0, '#2b0a4d'); sky.addColorStop(0.55, '#7a0f6e'); sky.addColorStop(1, '#0a0a2e');
  } else {
    sky.addColorStop(0, '#ff9a3d'); sky.addColorStop(0.5, '#ff5e7a'); sky.addColorStop(1, '#5b2a86');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Low sun over the skyline.
  const sx = rect.x + rect.w * (0.3 + 0.4 * ((seed * 37) % 10) / 10);
  const sy = rect.y + rect.h * 0.32;
  const sr = Math.min(rect.w, rect.h) * 0.16;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr);
  glow.addColorStop(0, 'rgba(255,244,200,0.95)');
  glow.addColorStop(0.55, 'rgba(255,180,90,0.75)');
  glow.addColorStop(1, 'rgba(255,120,80,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // Rooftop blocks along the bottom.
  ctx.fillStyle = 'rgba(10,6,18,0.85)';
  let bx = rect.x;
  const base = rect.y + rect.h * 0.78;
  while (bx < rect.x + rect.w) {
    const bw = rect.w * (0.08 + 0.05 * (((seed + bx) % 7) / 7));
    const bh = rect.h * (0.1 + 0.16 * (((seed * 3 + bx) % 5) / 5));
    ctx.fillRect(bx, base - bh, bw, bh + rect.h * 0.22);
    bx += bw + rect.w * 0.02;
  }
  // Invitation where the photo will go.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.max(12, rect.h * 0.045)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h * 0.55);
}

// Colour grade wash over the whole cover, clipped to the frame.
function applyGrade(ctx, grade, W, H, frame) {
  const { x, y, w, h } = frame;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (grade === 'sunset') {
    const wash = ctx.createLinearGradient(x, y, x, y + h);
    wash.addColorStop(0, 'rgba(255,140,50,0.16)');
    wash.addColorStop(0.45, 'rgba(255,80,110,0.20)');
    wash.addColorStop(1, 'rgba(110,40,170,0.26)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const warmth = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
    warmth.addColorStop(0, 'rgba(255,110,40,0)');
    warmth.addColorStop(1, 'rgba(255,90,30,0.14)');
    ctx.fillStyle = warmth; ctx.fillRect(x, y, w, h);
  } else if (grade === 'neon') {
    const wash = ctx.createLinearGradient(x, y, x + w, y + h);
    wash.addColorStop(0, 'rgba(255,0,170,0.20)');
    wash.addColorStop(0.5, 'rgba(0,220,255,0.14)');
    wash.addColorStop(1, 'rgba(140,0,255,0.22)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    // Neon edge glow: magenta stroke, then a cyan stroke just inside it.
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
    // Noir: a cool desaturated wash; the vignette below does the rest.
    ctx.fillStyle = 'rgba(20,24,40,0.18)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Halftone dot tile, cached per cover size.
const halftoneCache = new Map();
function halftonePattern(size) {
  if (halftoneCache.has(size)) return halftoneCache.get(size);
  const s = Math.max(6, Math.round(size / 90));
  const tile = document.createElement('canvas');
  tile.width = tile.height = s * 2;
  const t = tile.getContext('2d');
  t.fillStyle = 'rgba(0,0,0,0.55)';
  t.beginPath(); t.arc(s / 2, s / 2, s * 0.22, 0, Math.PI * 2); t.fill();
  t.beginPath(); t.arc(s * 1.5, s * 1.5, s * 0.22, 0, Math.PI * 2); t.fill();
  halftoneCache.set(size, tile);
  return tile;
}

// Film grain tile (seeded noise), cached per cover size.
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

// Darken the edges of the whole cover.
function applyVignette(ctx, W, H, strength) {
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Big bold caption with outline, drop shadow and a per-grade gradient fill.
// Returns the font size used. In the Four-Up grid the caption is set smaller
// and lower, so the lettering band stays clear of the faces in the bottom row.
function drawCaption(ctx, caption, subtitle, W, H, grade, layout) {
  const compact = layout === 1;
  const bandH = compact ? H * 0.18 : H * 0.24;
  const bandY = H - bandH;
  // Legibility gradient at the bottom of the cover.
  const bg = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(0.55, 'rgba(0,0,0,0.42)');
  bg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY - H * 0.06, W, H - bandY + H * 0.06);

  const text = (caption || 'NEON COAST').toUpperCase().slice(0, 40);
  const maxW = W * 0.92;
  let fs = compact ? H * 0.095 : H * 0.135;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `${s}px Anton, "Arial Black", "Archivo Black", sans-serif`; };
  setFont(fs);
  while (fs > H * 0.04 && ctx.measureText(text).width > maxW) {
    fs *= 0.94;
    setFont(fs);
  }
  const cx = W / 2;
  const cy = H - (compact ? H * 0.026 : H * 0.055);
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
  // A thin bright highlight along the top edge of the letters.
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1.5, fs * 0.012);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(text, cx, cy - fs * 0.02);
  ctx.restore();

  // Subtitle: letter-spaced small caps sitting above the caption.
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

// Main entry: paint the whole cover.
// state: { layout, grade, halftone, grain, caption, subtitle, photos, onePhoto }
export function drawCover(ctx, state, W, H) {
  const grade = state.grade || 'sunset';
  const layout = state.layout || 0;
  const photos = state.photos || [];

  // Paper-white background: it shows through as the gutters + outer frame.
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, W, H);

  const f = Math.round(Math.min(W, H) * 0.014);
  const frame = { x: f, y: f, w: W - 2 * f, h: H - 2 * f };
  const panels = layoutPanels(layout, W, H);
  const indexes = panelPhotoIndexes(layout, photos.length, state.onePhoto);

  // Count showings per photo so repeats get different crops (see panelCropOffset).
  const showings = {};
  panels.forEach((rect, i) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    const photo = photos[indexes[i]];
    let painted = false;
    if (photo && photo.img) {
      const seen = showings[indexes[i]] || 0;
      showings[indexes[i]] = seen + 1;
      const shift = panelCropOffset(seen);
      const framed = {
        img: photo.img,
        fit: photo.fit,
        // A repeat is also framed a touch tighter, so it reads as a
        // different shot of the same photo rather than a copy-paste.
        zoom: (photo.zoom || 1) * (1 + 0.06 * seen),
        ox: Math.max(-1, Math.min(1, (photo.ox || 0) + shift.ox)),
        oy: Math.max(-1, Math.min(1, (photo.oy || 0) + shift.oy + upperThirdBias(photo, rect))),
      };
      // Per-grade photo filter.
      if (grade === 'sunset') ctx.filter = 'saturate(1.3) contrast(1.06) brightness(1.02)';
      else if (grade === 'neon') ctx.filter = 'saturate(1.65) contrast(1.28) brightness(1.0)';
      else ctx.filter = 'grayscale(1) contrast(1.18) brightness(0.96)';
      painted = drawPhotoInto(ctx, framed, rect);
      ctx.filter = 'none';
    }
    if (!painted) drawPlaceholder(ctx, rect, grade, i + 1);
    ctx.restore();
  });

  // The sunset grade carries its sky through the gradient wash alone:
  // no sun disc is painted over a photo, so nothing can sit on hair or a face.
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

  drawCaption(ctx, state.caption, state.subtitle, W, H, grade, layout);
  ctx.restore();
}
