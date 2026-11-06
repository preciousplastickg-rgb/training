// Гладкая кожа манекена: контуры сегментов (src/data/skin.ts) в кадре по позе рига.
// Сегменты накладываются с запасом у суставов и рисуются одной заливкой — получается сплошное тело.
// Для объёма у каждого сегмента свой градиент поперёк оси: края темнее, середина светлее.

import {
  FRONT_FOREARM, FRONT_HEAD, FRONT_NECK, FRONT_SHIN, FRONT_THIGH, FRONT_TORSO_HALF, FRONT_UPPER_ARM,
  SIDE_FOOT, SIDE_FOREARM, SIDE_HEAD, SIDE_NECK, SIDE_PELVIS, SIDE_SHIN, SIDE_THIGH, SIDE_TORSO, SIDE_UPPER_ARM, type Outline,
} from '../data/skin';
import { MAP_FOOT_L } from '../data/anatomy';
import { mapToWorld, MAP_SCALE } from './anatomy';
import { dir, type FrontPose, type Pt, type SidePose } from './pose';

/** Слой отрисовки: дальние конечности — за телом и темнее; ближняя рука — поверх корпуса со своим контуром. */
export type SkinLayer = 'farArm' | 'farLeg' | 'body' | 'nearArm';

export interface SkinShape {
  key: string;
  /** Контур в кадре: путь SVG (кубические Безье). */
  d: string;
  layer: SkinLayer;
  /** Ось градиента объёма: от края o − n·half до края o + n·half. */
  grad: { o: Pt; n: Pt; half: number };
}

interface Frame {
  o: Pt;
  u: Pt;
  n: Pt;
}

const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};
/** Сегмент «вниз» (бедро, голень, руки): передняя сторона — (u.y, −u.x). */
const downFrame = (o: Pt, to: Pt): Frame => {
  const u = unit(o, to);
  return { o, u, n: { x: u.y, y: -u.x } };
};
/** Сегмент «вверх» (таз, корпус, шея): передняя сторона — (−u.y, u.x). */
const upFrame = (o: Pt, u: Pt): Frame => ({ o, u, n: { x: -u.y, y: u.x } });
const at = (f: Frame, s: number, w: number): Pt => ({ x: f.o.x + f.u.x * s + f.n.x * w, y: f.o.y + f.u.y * s + f.n.y * w });

const f1 = (n: number) => Math.round(n * 10) / 10;

/** Замкнутый сплайн Catmull-Rom через точки → кубические Безье. */
export function smoothClosed(pts: readonly Pt[], tension = 1): string {
  const n = pts.length;
  if (n < 3) return '';
  const k = tension / 6;
  let d = `M${f1(pts[0]!.x)} ${f1(pts[0]!.y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
    const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
    d += `C${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  return d + 'Z';
}

/** Контур сегмента в кадре; sScale растягивает вдоль оси (укороченное бедро сидя, масштаб карты). */
function shape(key: string, layer: SkinLayer, f: Frame, outline: Outline, sScale = 1, wScale = 1): SkinShape {
  const pts = outline.map(([s, w]) => at(f, s * sScale, w * wScale));
  const half = Math.max(...outline.map(([, w]) => Math.abs(w))) * wScale;
  // Градиент — поперёк середины сегмента.
  const mid = outline.reduce((a, [s]) => a + s, 0) / outline.length;
  return { key, d: smoothClosed(pts), layer, grad: { o: at(f, mid * sScale, 0), n: f.n, half } };
}

/** Вид сбоку. Порядок — порядок отрисовки: дальняя рука, дальняя нога, тело (нога, таз, корпус, шея, голова), ближняя рука. */
export function sideSkin(p: SidePose): SkinShape[] {
  const out: SkinShape[] = [];
  const leg = (prefix: string, layer: SkinLayer, knee: Pt, ankle: Pt, heel: Pt, toe: Pt) => {
    const fu = unit(heel, toe);
    out.push(shape(`${prefix}foot`, layer, { o: ankle, u: fu, n: { x: fu.y, y: -fu.x } }, SIDE_FOOT));
    out.push(shape(`${prefix}shin`, layer, downFrame(knee, ankle), SIDE_SHIN));
    out.push(shape(`${prefix}thigh`, layer, downFrame(p.hip, knee), SIDE_THIGH));
  };
  const arm = (prefix: string, layer: SkinLayer, elbow: Pt, wrist: Pt) => {
    out.push(shape(`${prefix}upperArm`, layer, downFrame(p.shoulder, elbow), SIDE_UPPER_ARM));
    out.push(shape(`${prefix}forearm`, layer, downFrame(elbow, wrist), SIDE_FOREARM));
  };
  arm('armL-', 'farArm', p.elbowL, p.wristL);
  if (p.kneeB && p.ankleB && p.heelB && p.toeB) leg('legB-', 'farLeg', p.kneeB, p.ankleB, p.heelB, p.toeB);
  leg('leg-', 'body', p.knee, p.ankle, p.heel, p.toe);
  out.push(shape('pelvis', 'body', upFrame(p.hip, dir(p.a.pelvis)), SIDE_PELVIS));
  out.push(shape('torso', 'body', upFrame(p.hip, dir(p.a.torso)), SIDE_TORSO));
  const neck = upFrame(p.shoulder, unit(p.shoulder, p.head));
  out.push(shape('neck', 'body', neck, SIDE_NECK));
  out.push(shape('head', 'body', neck, SIDE_HEAD));
  arm('armR-', 'nearArm', p.elbowR, p.wristR);
  return out;
}

const mirrorMap = (p: Pt): Pt => ({ x: 100 - p.x, y: p.y });

/**
 * Вид спереди по суставам фигуры карты (в кадре). Длины контуров заданы в координатах карты,
 * поэтому вдоль оси — масштаб карты, поперёк — тоже; укороченное бедро сидя — по фактической длине.
 */
export function frontSkin(p: FrontPose): SkinShape[] {
  const out: SkinShape[] = [];
  const k = MAP_SCALE;
  // Суставы позы уже сдвинуты к полу (fitOffset); контуры карты переносим на то же смещение.
  const ref = mapToWorld({ x: 50, y: 100 });
  const off = { x: p.pelvis.x - ref.x, y: p.pelvis.y - ref.y };
  const w = (q: Pt): Pt => {
    const m = mapToWorld(q);
    return { x: m.x + off.x, y: m.y + off.y };
  };
  const limb = (key: string, layer: SkinLayer, a: Pt, b: Pt, outline: Outline, mapLen: number) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    out.push(shape(key, layer, downFrame(a, b), outline, len / mapLen, k));
  };
  const foot = (key: string, ankle: Pt, side: 'L' | 'R') => {
    const pts = MAP_FOOT_L.map(([x, y]) => (side === 'L' ? { x, y } : mirrorMap({ x, y })));
    // Стопа карты стоит под голеностопом (74.5, 195): переносим к фактическому голеностопу.
    const ref = mapToWorld(side === 'L' ? { x: 74.5, y: 195 } : mirrorMap({ x: 74.5, y: 195 }));
    const world = pts.map(mapToWorld).map((q) => ({ x: q.x + ankle.x - ref.x, y: q.y + ankle.y - ref.y }));
    out.push({ key, d: smoothClosed(world, 0.7), layer: 'body', grad: { o: ankle, n: { x: 1, y: 0 }, half: 6 * k } });
  };
  foot('footL', p.ankleL, 'L');
  foot('footR', p.ankleR, 'R');
  limb('shinL', 'body', p.kneeL, p.ankleL, FRONT_SHIN, 46.5);
  limb('shinR', 'body', p.kneeR, p.ankleR, FRONT_SHIN, 46.5);
  limb('thighL', 'body', p.hipL, p.kneeL, FRONT_THIGH, 50.5);
  limb('thighR', 'body', p.hipR, p.kneeR, FRONT_THIGH, 50.5);
  const half = FRONT_TORSO_HALF.map(([x, y]) => ({ x, y }));
  const torso = [...half, ...half.slice(1, -1).reverse().map(mirrorMap)].map(w);
  out.push({ key: 'torso', d: smoothClosed(torso, 0.9), layer: 'body', grad: { o: p.pelvis, n: { x: 1, y: 0 }, half: 26 * k } });
  const neckPts = FRONT_NECK.map(([x, y]) => w({ x, y }));
  out.push({ key: 'neck', d: smoothClosed(neckPts, 0.4), layer: 'body', grad: { o: p.neck, n: { x: 1, y: 0 }, half: 6 * k } });
  const headPts = FRONT_HEAD.map(([x, y]) => w({ x, y }));
  out.push({ key: 'head', d: smoothClosed(headPts), layer: 'body', grad: { o: p.head, n: { x: 1, y: 0 }, half: 10 * k } });
  limb('upperArmL', 'nearArm', p.shoulderL, p.elbowL, FRONT_UPPER_ARM, 28.4);
  limb('forearmL', 'nearArm', p.elbowL, p.wristL, FRONT_FOREARM, 32.2);
  limb('upperArmR', 'nearArm', p.shoulderR, p.elbowR, FRONT_UPPER_ARM, 28.4);
  limb('forearmR', 'nearArm', p.elbowR, p.wristR, FRONT_FOREARM, 32.2);
  return out;
}
