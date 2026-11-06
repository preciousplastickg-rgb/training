// Анатомическая фигура: где каждая пластина-мышца в кадре.
// Вид сбоку — пластины из src/data/anatomy.ts по позе рига (src/domain/pose.ts).
// Вид спереди — полигоны карты мышц, руки поворачиваются вокруг плеча и локтя.

import {
  ARM_PLATES, HEAD_PLATES, LEG_PLATES, MAP_FOOT_L, MAP_HAND, MAP_PARTS, MAP_REST, MAP_SKELETON, MUSCLE_SLUGS, PELVIS_PLATES,
  SIDE_WIDTH, TORSO_PLATES, type MapPart, type PlateTone, type SidePlate, type SideSegment,
} from '../data/anatomy';
import type { ExerciseAnimation } from '../data/animations';
import { anteriorData, type MapSlug } from '../data/muscleMap';
import type { Muscle } from '../db/types';
import { dir, type FrontPose, type Joints, type Pt, type SidePose } from './pose';

export interface Placed {
  key: string;
  pts: Pt[];
  tone: PlateTone;
  /** Мышцы, за которые пластина подсвечивается. */
  muscles: Muscle[];
  /** Дальняя рука или нога — рисуется бледнее, за корпусом. */
  far: boolean;
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

function place(plates: readonly SidePlate[], frames: Partial<Record<SideSegment, Frame>>, far: boolean, prefix: string): Placed[] {
  const out: Placed[] = [];
  for (const p of plates) {
    const f = frames[p.seg];
    if (!f) continue;
    // Голова — в системе шеи, но не утолщается.
    const k = p.id === 'head' ? 1 : SIDE_WIDTH[p.seg];
    out.push({ key: prefix + p.id, pts: p.pts.map(([s, w]) => at(f, s, w * k)), tone: p.tone, muscles: p.muscle ? [p.muscle] : [], far });
  }
  return out;
}

/** Пластины вида сбоку в порядке отрисовки: дальняя рука, дальняя нога, ближняя нога, таз, корпус, голова, ближняя рука. */
export function sidePlates(p: SidePose): Placed[] {
  const leg = (knee: Pt, ankle: Pt, heel: Pt, toe: Pt): Partial<Record<SideSegment, Frame>> => {
    const fu = unit(heel, toe);
    return { thigh: downFrame(p.hip, knee), shin: downFrame(knee, ankle), foot: { o: ankle, u: fu, n: { x: fu.y, y: -fu.x } } };
  };
  const arm = (elbow: Pt, wrist: Pt): Partial<Record<SideSegment, Frame>> => ({
    upperArm: downFrame(p.shoulder, elbow),
    forearm: downFrame(elbow, wrist),
  });
  const body: Partial<Record<SideSegment, Frame>> = {
    pelvis: upFrame(p.hip, dir(p.a.pelvis)),
    torso: upFrame(p.hip, dir(p.a.torso)),
    neck: upFrame(p.shoulder, unit(p.shoulder, p.head)),
  };
  const out: Placed[] = [];
  out.push(...place(ARM_PLATES, arm(p.elbowL, p.wristL), true, 'armL-'));
  if (p.kneeB && p.ankleB && p.heelB && p.toeB) out.push(...place(LEG_PLATES, leg(p.kneeB, p.ankleB, p.heelB, p.toeB), true, 'legB-'));
  out.push(...place(LEG_PLATES, leg(p.knee, p.ankle, p.heel, p.toe), false, 'leg-'));
  out.push(...place(PELVIS_PLATES, body, false, ''));
  out.push(...place(TORSO_PLATES, body, false, ''));
  out.push(...place(HEAD_PLATES, body, false, ''));
  out.push(...place(ARM_PLATES, arm(p.elbowR, p.wristR), false, 'armR-'));
  return out;
}

/** Где кисть держит снаряд: середина пластины кисти. */
export function handPoint(elbow: Pt, wrist: Pt): Pt {
  const u = unit(elbow, wrist);
  return { x: wrist.x + u.x * 5, y: wrist.y + u.y * 5 };
}

// ---------- Вид спереди: фигура карты мышц ----------

/** Масштаб карты (viewBox 100 × 220) в кадр манекена 200 × 200: фигура ≈ 176 px. */
export const MAP_SCALE = 0.86;

const SLUG_MUSCLES: Partial<Record<MapSlug, Muscle[]>> = {};
for (const [m, slugs] of Object.entries(MUSCLE_SLUGS) as [Muscle, MapSlug[]][]) {
  for (const s of slugs) (SLUG_MUSCLES[s] ??= []).push(m);
}

const parsePts = (s: string): Pt[] => {
  const n = s.trim().split(/\s+/).map(Number);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i]!, y: n[i + 1]! });
  return out;
};

/** Полигоны карты спереди, разобранные один раз: слаг, сегмент, сторона. */
const FRONT_POLYS = anteriorData.flatMap((g) =>
  g.svgPoints.map((s, i) => {
    const pts = parsePts(s);
    const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length;
    return { key: `${g.muscle}-${i}`, slug: g.muscle, part: MAP_PARTS[g.muscle] as MapPart, side: cx > 50 ? ('L' as const) : ('R' as const), pts };
  }),
);

/** Поворот вокруг c на θ градусов (как SVG rotate: «+» — по часовой на экране). */
function rot(p: Pt, c: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(r) - dy * Math.sin(r), y: c.y + dx * Math.sin(r) + dy * Math.cos(r) };
}

const mirror = (p: Pt): Pt => ({ x: 100 - p.x, y: p.y });
/** Координаты карты (viewBox 100 × 220) → кадр манекена 200 × 200. */
export const mapToWorld = (p: Pt): Pt => ({ x: 100 + (p.x - 50) * MAP_SCALE, y: p.y * MAP_SCALE });
const toWorld = mapToWorld;

export interface FrontFigure {
  /** Суставы в кадре (без смещения к полу) — для снарядов, опор и подсказок углов. */
  pose: FrontPose;
  plates: Placed[];
}

/**
 * Фигура карты мышц в позе: отведение плеча shoulderL/R (0 — вниз, 90 — в сторону, 180 — вверх),
 * сгибание локтя elbowL/R в той же плоскости. Сидя бёдра направлены на зрителя — видны укороченными.
 */
export function frontFigure(anim: Pick<ExerciseAnimation, 'rig'>, joints: Joints): FrontFigure {
  const abL = Math.abs(joints.shoulderL ?? 0);
  const abR = Math.abs(joints.shoulderR ?? 0);
  const faL = abL + (joints.elbowL ?? 0);
  const faR = abR + (joints.elbowR ?? 0);
  const hipFlex = anim.rig === 'seated' ? (joints.hip ?? 90) : (joints.hip ?? 0);
  // Видимая доля бедра: не меньше 0,3 — бедро, направленное на зрителя, всё равно видно своей толщиной.
  const thighScale = Math.max(0.3, Math.abs(Math.cos((hipFlex * Math.PI) / 180)));

  const K = MAP_SKELETON;
  const side = (s: 'L' | 'R') => {
    const m = s === 'L' ? (p: Pt) => p : mirror;
    const sign = s === 'L' ? -1 : 1; // L на экране справа: подъём — против часовой
    const ab = s === 'L' ? abL : abR;
    const fa = s === 'L' ? faL : faR;
    const S = m(K.shoulderL);
    const E0 = m(K.elbowL);
    const W0 = m(K.wristL);
    const thU = sign * (ab - MAP_REST.upperArm);
    const thF = sign * (fa - MAP_REST.forearm);
    const E = rot(E0, S, thU);
    const forearm = (p: Pt): Pt => {
      const q = rot(p, E0, thF);
      return { x: q.x + E.x - E0.x, y: q.y + E.y - E0.y };
    };
    const hip = m(K.hipL);
    const knee0 = m(K.kneeL);
    const shinDy = -(knee0.y - hip.y) * (1 - thighScale);
    return {
      S, E, W: forearm(W0), hip,
      knee: { x: knee0.x, y: knee0.y + shinDy },
      ankle: { x: m(K.ankleL).x, y: m(K.ankleL).y + shinDy },
      tf: (part: MapPart, p: Pt): Pt => {
        if (part === 'upperArm') return rot(p, S, thU);
        if (part === 'delt') return rot(p, S, thU * 0.55);
        if (part === 'forearm') return forearm(p);
        if (part === 'thigh') return { x: p.x, y: hip.y + (p.y - hip.y) * thighScale };
        if (part === 'shin') return { x: p.x, y: p.y + shinDy };
        return p;
      },
    };
  };
  const L = side('L');
  const R = side('R');

  const plates: Placed[] = [];
  const push = (key: string, pts: Pt[], tone: PlateTone, muscles: Muscle[]) => plates.push({ key, pts: pts.map(toWorld), tone, muscles, far: false });
  // Ноги и корпус — снизу, руки — поверх корпуса.
  const order: MapPart[] = ['shin', 'thigh', 'torso', 'delt', 'upperArm', 'forearm'];
  for (const part of order) {
    if (part === 'shin') {
      push('footL', MAP_FOOT_L.map(([x, y]) => L.tf('shin', { x, y })), 'neutral', []);
      push('footR', MAP_FOOT_L.map(([x, y]) => R.tf('shin', mirror({ x, y }))), 'neutral', []);
    }
    for (const poly of FRONT_POLYS) {
      if (poly.part !== part) continue;
      const s = poly.side === 'L' ? L : R;
      const tone: PlateTone = poly.slug === 'head' || poly.slug === 'knees' ? 'neutral' : 'idle';
      push(poly.key, poly.pts.map((p) => s.tf(part, p)), tone, SLUG_MUSCLES[poly.slug] ?? []);
    }
    if (part === 'forearm') {
      for (const [k, s] of [['handL', L], ['handR', R]] as const) {
        const f = downFrame(s.W, { x: s.W.x + (s.W.x - s.E.x), y: s.W.y + (s.W.y - s.E.y) });
        push(k, MAP_HAND.map(([a, b]) => at(f, a, b)), 'neutral', []);
      }
    }
  }

  const pose: FrontPose = {
    view: 'front',
    pelvis: toWorld(K.pelvis),
    neck: toWorld(K.neck),
    head: toWorld(K.head),
    shoulderL: toWorld(L.S), shoulderR: toWorld(R.S),
    elbowL: toWorld(L.E), elbowR: toWorld(R.E),
    wristL: toWorld(L.W), wristR: toWorld(R.W),
    hipL: toWorld(L.hip), hipR: toWorld(R.hip),
    kneeL: toWorld(L.knee), kneeR: toWorld(R.knee),
    ankleL: toWorld(L.ankle), ankleR: toWorld(R.ankle),
    a: { upperArmL: abL, upperArmR: abR, forearmL: faL, forearmR: faR },
    thighScale, shinScale: 1,
  };
  return { pose, plates };
}
