#!/usr/bin/env node
// npm run sync-3d — ассеты двойника из exercise-anim (docs/TWIN-3D.md, раздел 2).
//
// 1. Бюджеты раздела 2 проверяются в источнике до копирования: превышение — ошибка, public/3d/ не трогается.
// 2. dist/ копируется в public/3d/ целиком (старые файлы удаляются).
// 3. Декодер Draco — draco_wasm_wrapper.js и draco_decoder.wasm из three/examples/jsm/libs/draco/gltf/ в public/draco/
//    (без CDN и без JS-фолбэка, раздел 3).
// 4. Сверка id: у каждого упражнения блока 1 из программы есть запись в manifest.json, иначе — список недостающих.
//
// Источник: EXERCISE_ANIM_DIST из окружения, иначе из .env.local (не в git), иначе ../exercise-anim/dist рядом с проектом.
// Единицы бюджетов десятичные (1 КБ = 1000 Б), как в exercise-anim.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// переменная окружения важнее файла: process.loadEnvFile не перезаписывает заданные значения
const ENV_LOCAL = path.join(ROOT, '.env.local');
if (fs.existsSync(ENV_LOCAL)) process.loadEnvFile(ENV_LOCAL);
const SRC = path.resolve(process.env.EXERCISE_ANIM_DIST ?? path.join(ROOT, '..', 'exercise-anim', 'dist'));
const DEST = path.join(ROOT, 'public', '3d');
const DRACO_SRC = path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf');
const DRACO_DEST = path.join(ROOT, 'public', 'draco');
const DRACO_FILES = ['draco_wasm_wrapper.js', 'draco_decoder.wasm'];

const KB = 1000;
const BUDGETS = [
  { test: (f) => f === 'twin.glb', max: 1000 * KB, what: 'twin.glb' },
  { test: (f) => f === 'twin_id.webp', max: 40 * KB, what: 'карта зон' },
  { test: (f) => f === 'twin_idsoft.webp', max: 120 * KB, what: 'мягкий край' },
  { test: (f) => f === 'twin_fibre.webp', max: 300 * KB, what: 'волокна' },
  { test: (f) => /^ex\/[^/]+\.glb$/.test(f), max: 200 * KB, what: 'клип упражнения' },
  { test: (f) => /^ex\/[^/]+_(start|end)\.webp$/.test(f), max: 60 * KB, what: 'кадр' },
];

const fmtKb = (b) => `${(b / KB).toFixed(1).replace('.', ',')} КБ`;
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many}`;
};

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

function fail(msg) {
  console.error(`sync-3d: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(SRC, 'manifest.json'))) {
  fail(`нет ${path.join(SRC, 'manifest.json')}. Укажите папку dist проекта exercise-anim в .env.local (EXERCISE_ANIM_DIST=/путь/к/exercise-anim/dist) или в окружении`);
}

// ---------- 1. Бюджеты и целостность манифеста (в источнике) ----------
const files = walk(SRC).filter((f) => !f.startsWith('.') && !f.includes('/.'));
const over = [];
for (const f of files) {
  const size = fs.statSync(path.join(SRC, f)).size;
  const b = BUDGETS.find((x) => x.test(f));
  if (b && size > b.max) over.push(`${f} — ${fmtKb(size)} > ${fmtKb(b.max)} (${b.what})`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const missingFiles = [];
for (const want of [manifest.twin?.file ?? 'twin.glb', 'muscles.json', 'twin_id.webp', 'twin_idsoft.webp', 'twin_fibre.webp']) {
  if (!files.includes(want)) missingFiles.push(want);
}
for (const [id, e] of Object.entries(manifest.exercises ?? {})) {
  for (const f of [e.file, ...(e.stills ?? [])]) if (!files.includes(f)) missingFiles.push(`${f} (${id})`);
}
if (over.length) fail(`превышены бюджеты (docs/TWIN-3D.md, раздел 2):\n  ${over.join('\n  ')}`);
if (missingFiles.length) fail(`в манифесте есть файлы, которых нет в источнике:\n  ${missingFiles.join('\n  ')}`);

// ---------- 2. Копирование ----------
fs.rmSync(DEST, { recursive: true, force: true });
let bytes = 0;
for (const f of files) {
  const to = path.join(DEST, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(SRC, f), to);
  bytes += fs.statSync(to).size;
}

// ---------- 3. Декодер Draco ----------
if (!fs.existsSync(DRACO_SRC)) fail(`нет ${DRACO_SRC}: сначала npm install`);
fs.rmSync(DRACO_DEST, { recursive: true, force: true });
fs.mkdirSync(DRACO_DEST, { recursive: true });
let dracoBytes = 0;
for (const f of DRACO_FILES) {
  if (!fs.existsSync(path.join(DRACO_SRC, f))) fail(`нет ${path.join(DRACO_SRC, f)}: проверить версию three`);
  fs.copyFileSync(path.join(DRACO_SRC, f), path.join(DRACO_DEST, f));
  dracoBytes += fs.statSync(path.join(DRACO_DEST, f)).size;
}

// ---------- 4. Сверка с программой: блок 1 ----------
const { runnerImport } = await import('vite');
const { module: program } = await runnerImport(path.join(ROOT, 'src', 'data', 'program.ts'), { root: ROOT, logLevel: 'silent' });
const block1 = new Set();
const alts = new Set();
for (const s of program.SEED_SLOTS) {
  if (s.block !== 1) continue;
  block1.add(s.exerciseId);
  for (const a of s.altExerciseIds) alts.add(a);
}
const ids = Object.keys(manifest.exercises ?? {});
const missing = [...block1].filter((id) => !manifest.exercises[id]).sort();
const altMissing = [...alts].filter((id) => !block1.has(id) && !manifest.exercises[id]).sort();
const extra = ids.filter((id) => !block1.has(id) && !alts.has(id)).sort();

console.log(`sync-3d: ${SRC} → public/3d/: ${files.length} файлов, ${fmtKb(bytes)}; декодер Draco → public/draco/: ${fmtKb(dracoBytes)}`);
console.log(`  в манифесте ${plural(ids.length, 'упражнение', 'упражнения', 'упражнений')}; в блоке 1 программы ${plural(block1.size, 'упражнение', 'упражнения', 'упражнений')} и ${plural(alts.size, 'замена', 'замены', 'замен')}`);
if (missing.length) console.log(`  нет 3D для упражнений блока 1 (${missing.length}): ${missing.join(', ')}`);
else console.log('  все упражнения блока 1 есть в манифесте');
if (altMissing.length) console.log(`  замены блока 1 без 3D: ${altMissing.join(', ')} — покажут подсказки без 3D`);
if (extra.length) console.log(`  в манифесте сверх блока 1: ${extra.join(', ')}`);
