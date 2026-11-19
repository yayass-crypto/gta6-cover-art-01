// Neon Coast Cover Maker — make.fun program entry (gta6-cover-art-01).
//
// Copies app/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the
// kit's vendor library. Node 22 stdlib only, no build step.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// (defaults to /output when MAKEFUN_OUTPUT_DIR is unset)

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
} as const;

function copyTree(name: string): void {
  const src = join(REPO_ROOT, name);
  const dst = join(OUT_DIR, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in ${REPO_ROOT}`);
  cpSync(src, dst, { recursive: true, dereference: false });
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  // Start clean so a stale file from an earlier run can never leak in.
  for (const name of ['app', 'screenshots', 'dossier.json']) {
    const p = join(OUT_DIR, name);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
  copyTree('app');
  copyTree('screenshots');
  const dossier = buildDossier(OUT_DIR, DOSSIER_CAPS);
  writeFileSync(join(OUT_DIR, 'dossier.json'), dossier);
  const countFiles = (dir: string): number => {
    let n = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
    }
    return n;
  };
  console.log(`wrote ${join(OUT_DIR, 'dossier.json')} (${dossier.length} bytes)`);
  console.log(`app/: ${countFiles(join(OUT_DIR, 'app'))} files, screenshots/: ${countFiles(join(OUT_DIR, 'screenshots'))} files`);
}

main();
