#!/usr/bin/env node
// Выжимка эталона Blender для e2e (этап 5c): exercise-anim/renders/viewer_dqs_ref.json → e2e/fixtures/dqs_ref.json.
// Три позы (упражнение, время клипа, веса fix_*), из каждой — 300 вершин равномерно по номеру: положение в позе
// связывания (для сопоставления) и в позе (DQS + морфы в Blender), координаты glTF, метры, 0,01 мм.
//
//   node scripts/dqs-ref-fixture.mjs [путь к viewer_dqs_ref.json]
// По умолчанию — renders/ рядом с EXERCISE_ANIM_DIST (.env.local), иначе ../exercise-anim/renders.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = path.join(ROOT, '.env.local');
if (fs.existsSync(ENV_LOCAL)) process.loadEnvFile(ENV_LOCAL);
const dist = path.resolve(process.env.EXERCISE_ANIM_DIST ?? path.join(ROOT, '..', 'exercise-anim', 'dist'));
const src = process.argv[2] ?? path.join(dist, '..', 'renders', 'viewer_dqs_ref.json');
const out = path.join(ROOT, 'e2e', 'fixtures', 'dqs_ref.json');
const N = 300;

const ref = JSON.parse(fs.readFileSync(src, 'utf8'));
const r5 = (v) => v.map((x) => Math.round(x * 1e5) / 1e5);
const poses = Object.values(ref).map((p) => {
  const step = p.rest.length / N;
  const idx = Array.from({ length: N }, (_, k) => Math.floor(k * step));
  return { exercise: p.exercise, t: p.t, weights: p.weights, rest: idx.map((i) => r5(p.rest[i])), posed: idx.map((i) => r5(p.posed[i])) };
});
fs.writeFileSync(out, JSON.stringify({ source: 'exercise-anim/renders/viewer_dqs_ref.json (tools/dqs_ref.py)', poses }));
console.log(`dqs-ref-fixture: ${poses.length} позы × ${N} вершин → ${path.relative(ROOT, out)}, ${(fs.statSync(out).size / 1000).toFixed(1)} КБ`);
