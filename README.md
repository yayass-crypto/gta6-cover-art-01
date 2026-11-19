# Neon Coast Cover Maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/yayass-crypto/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/yayass-crypto/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn your photos and a caption into GTA-style multi-panel poster cover art —
and export it as a PNG to share. 100% local: photos are read on your machine
and never uploaded.

Built for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01)
bounty on make.fun.

## What it does

- **Any photo** — drop in up to 4 photos (or use the four built-in samples:
  Boulevard, Pier, Rooftop and Boardwalk), click a panel to select it, drag
  to pan, zoom with the slider, fit/fill per photo, or let one photo fill
  every panel. When one photo feeds several panels, each repeat is framed
  on a different part of the photo, so no two panels ever show the same crop.
- **4 layouts** — Hero + Duo (big left hero, two stacked right), Four-Up (2×2
  grid), Hero + Strip (big top hero, three below), Triptych (wide centre
  hero with narrow wings) — with white gutters and a black frame, the
  classic poster look. The caption band sits low and small in the Four-Up
  grid so the lettering stays clear of faces.
- **3 grades** — Sunset (orange → pink → purple wash, no pasted sun over
  your photos), Neon (magenta/cyan glow, high contrast), Noir (desaturated,
  heavy vignette) — plus halftone print dots and film grain toggles.
- **Bold caption lettering** — Anton display type with a thick outline, drop
  shadow and a per-grade gradient fill, plus a letter-spaced subtitle.
- **3 post sizes** — 1080 × 1080, 1080 × 1350, 1920 × 1080. The live preview
  is the exact cover that exports; **Export PNG** downloads it at full
  resolution.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no network needed, everything runs from
the files under `app/`.

## Screenshots

`screenshots/` shows the app at work: the exported cover, the editor with
the caption and size controls in frame, and the same cover in portrait and
square post sizes — each panel a different photo.

## Originality

All art is drawn in code from the user's own photos. No Rockstar Games logo,
wordmark, artwork, character or font is used anywhere. The display font is
Anton (SIL Open Font License, see `app/fonts/OFL.txt`); the sample photos
were made with an image model and are free to use. The fictional city in the
default caption is "Neon Coast".
