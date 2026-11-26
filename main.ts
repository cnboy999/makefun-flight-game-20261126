// Skyline Courier — the hand-in program (Node 22, standard library only).
//
// This program copies the game and its screenshots from beside this file
// into the output directory and writes the dossier there: the summary the
// judge reads, built by the vendored make.fun library from the files as they
// stand. It runs twice in the grader and both runs must write the same
// bytes, so it does nothing but copy and summarise — no timestamps, no
// random numbers, nothing that could differ between runs.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(output, { recursive: true });
cpSync(join(repo, 'game'), join(output, 'game'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
if (existsSync(join(repo, 'screenshots'))) {
  cpSync(join(repo, 'screenshots'), join(output, 'screenshots'), { recursive: true });
}

// The dossier is the judge's view of the entry, so write it last, after the
// files it summarises are already in place.
const dossierPath = join(output, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(output, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Second pass: check the hand-in is actually complete before reporting
// success, so a silent failure never looks like a finished entry.
const dossierSize = statSync(dossierPath).size;
if (dossierSize === 0) throw new Error('dossier.json was written empty');
const shotCount = readdirSync(join(output, 'screenshots')).filter((name) => !name.startsWith('.')).length;
if (shotCount < 3 || shotCount > 4) throw new Error(`expected 3 or 4 screenshots, found ${shotCount}`);
console.log(`Skyline Courier handed in: ${shotCount} screenshots, dossier ${dossierSize} bytes, in ${output}`);
