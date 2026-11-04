// Прямая кинематика манекена (соглашение об углах — в src/data/animations.ts).

import type { ExerciseAnimation, Joint } from '../data/animations';

export type Pt = { x: number; y: number };
export type Joints = Partial<Record<Joint, number>>;

export const SEG = {
  foot: 22, heel: 5, shin: 46, thigh: 48, torso: 56, neck: 7, head: 10, upperArm: 28, forearm: 26,
};

/** Направление по абсолютному углу: 0 — вверх, 90 — вперёд (вправо). */
export function dir(alpha: number): Pt {
  const r = (alpha * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}
const add = (p: Pt, d: Pt, l: number): Pt => ({ x: p.x + d.x * l, y: p.y + d.y * l });

export interface SidePose {
  view: 'side';
  hip: Pt; knee: Pt; ankle: Pt; heel: Pt; toe: Pt;
  kneeB?: Pt; ankleB?: Pt; heelB?: Pt; toeB?: Pt;
  shoulder: Pt; neck: Pt; head: Pt;
  elbowL: Pt; wristL: Pt; elbowR: Pt; wristR: Pt;
  /** Абсолютные углы сегментов. */
  a: { torso: number; thigh: number; shin: number; upperArmL: number; forearmL: number; upperArmR: number; forearmR: number; thighB?: number; shinB?: number; pelvis: number };
}

export interface FrontPose {
  view: 'front';
  pelvis: Pt; neck: Pt; head: Pt;
  shoulderL: Pt; shoulderR: Pt; elbowL: Pt; elbowR: Pt; wristL: Pt; wristR: Pt;
  hipL: Pt; hipR: Pt; kneeL: Pt; kneeR: Pt; ankleL: Pt; ankleR: Pt;
  a: { upperArmL: number; upperArmR: number; forearmL: number; forearmR: number };
  /** Видимая доля длины бедра/голени (ракурс). */
  thighScale: number; shinScale: number;
}

export type Pose = SidePose | FrontPose;

const j = (joints: Joints, k: Joint, def = 0) => joints[k] ?? def;

export function sidePose(anim: Pick<ExerciseAnimation, 'rig' | 'base'>, joints: Joints): SidePose {
  const knee = j(joints, 'knee');
  const hip = j(joints, 'hip');
  let aShin: number;
  let aThigh: number;
  let aPelvis: number;
  if (anim.rig === 'standing') {
    aShin = j(joints, 'ankle');
    aThigh = aShin + knee;
    aPelvis = aThigh + hip;
  } else {
    aPelvis = anim.base ?? 0;
    aThigh = aPelvis - hip;
    aShin = aThigh - knee;
  }
  const aTorso = aPelvis + j(joints, 'spine');
  const aNeck = aTorso + j(joints, 'neck');
  const aUaL = aTorso + 180 - j(joints, 'shoulderL');
  const aUaR = aTorso + 180 - j(joints, 'shoulderR');
  const aFaL = aUaL - j(joints, 'elbowL');
  const aFaR = aUaR - j(joints, 'elbowR');

  // Сначала строим от таза в (0,0), потом стойка сама переносит фигуру к опоре.
  const hipP: Pt = { x: 0, y: 0 };
  const kneeP = add(hipP, dir(aThigh), -SEG.thigh);
  const ankleP = add(kneeP, dir(aShin), -SEG.shin);
  const footDir = anim.rig === 'standing' ? 90 : aShin + 90;
  const toe = add(ankleP, dir(footDir), SEG.foot - SEG.heel);
  const heel = add(ankleP, dir(footDir), -SEG.heel);

  const shoulder = add(hipP, dir(aTorso), SEG.torso);
  const neck = add(shoulder, dir(aNeck), SEG.neck);
  const head = add(neck, dir(aNeck), SEG.head);
  const elbowL = add(shoulder, dir(aUaL), SEG.upperArm);
  const wristL = add(elbowL, dir(aFaL), SEG.forearm);
  const elbowR = add(shoulder, dir(aUaR), SEG.upperArm);
  const wristR = add(elbowR, dir(aFaR), SEG.forearm);

  const pose: SidePose = {
    view: 'side', hip: hipP, knee: kneeP, ankle: ankleP, heel, toe, shoulder, neck, head, elbowL, wristL, elbowR, wristR,
    a: { torso: aTorso, thigh: aThigh, shin: aShin, upperArmL: aUaL, forearmL: aFaL, upperArmR: aUaR, forearmR: aFaR, pelvis: aPelvis },
  };
  if (joints.hipB !== undefined || joints.kneeB !== undefined) {
    const aThighB = aPelvis - j(joints, 'hipB');
    const aShinB = aThighB - j(joints, 'kneeB');
    pose.kneeB = add(hipP, dir(aThighB), -SEG.thigh);
    pose.ankleB = add(pose.kneeB, dir(aShinB), -SEG.shin);
    pose.toeB = add(pose.ankleB, dir(aShinB + 90), SEG.foot - SEG.heel);
    pose.heelB = add(pose.ankleB, dir(aShinB + 90), -SEG.heel);
    pose.a.thighB = aThighB;
    pose.a.shinB = aShinB;
  }
  return pose;
}

export function frontPose(anim: Pick<ExerciseAnimation, 'rig'>, joints: Joints): FrontPose {
  const shoulderHalf = 17;
  const hipHalf = 9;
  const pelvis: Pt = { x: 0, y: 0 };
  const neck = { x: 0, y: -SEG.torso - SEG.neck };
  const head = { x: 0, y: neck.y - SEG.head };
  const shoulderL = { x: shoulderHalf, y: -SEG.torso + 4 };
  const shoulderR = { x: -shoulderHalf, y: -SEG.torso + 4 };
  // Левая рука человека — справа на экране. Отведение a: 0 — вниз, 90 — в сторону, 180 — вверх.
  const abL = Math.abs(j(joints, 'shoulderL'));
  const abR = Math.abs(j(joints, 'shoulderR'));
  const faL = abL + j(joints, 'elbowL');
  const faR = abR + j(joints, 'elbowR');
  const armDir = (ab: number, side: 1 | -1): Pt => {
    const r = (ab * Math.PI) / 180;
    return { x: side * Math.sin(r), y: Math.cos(r) };
  };
  const elbowL = add(shoulderL, armDir(abL, 1), SEG.upperArm);
  const wristL = add(elbowL, armDir(faL, 1), SEG.forearm);
  const elbowR = add(shoulderR, armDir(abR, -1), SEG.upperArm);
  const wristR = add(elbowR, armDir(faR, -1), SEG.forearm);
  // Ноги: сгибание в тазу и колене уходит «на зрителя» — видимая длина × |cos|.
  const hipFlex = anim.rig === 'seated' ? j(joints, 'hip', 90) : j(joints, 'hip');
  const thighScale = Math.max(0.12, Math.abs(Math.cos((hipFlex * Math.PI) / 180)));
  const shinAngle = hipFlex + j(joints, 'knee');
  const shinScale = Math.max(0.12, Math.abs(Math.cos((shinAngle * Math.PI) / 180)));
  const hipL = { x: hipHalf, y: 4 };
  const hipR = { x: -hipHalf, y: 4 };
  const kneeL = { x: hipL.x + 1, y: hipL.y + SEG.thigh * thighScale };
  const kneeR = { x: hipR.x - 1, y: hipR.y + SEG.thigh * thighScale };
  const ankleL = { x: kneeL.x, y: kneeL.y + SEG.shin * shinScale };
  const ankleR = { x: kneeR.x, y: kneeR.y + SEG.shin * shinScale };
  return {
    view: 'front', pelvis, neck, head, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR,
    hipL, hipR, kneeL, kneeR, ankleL, ankleR,
    a: { upperArmL: abL, upperArmR: abR, forearmL: faL, forearmR: faR },
    thighScale, shinScale,
  };
}

export function poseFor(anim: ExerciseAnimation, joints: Joints): Pose {
  return anim.view === 'front' ? frontPose(anim, joints) : sidePose(anim, joints);
}

/** Интерполяция углов: easing cubic-bezier(0.45, 0, 0.55, 1). */
export function lerpJoints(a: Joints, b: Joints, t: number): Joints {
  const e = easeInOut(t);
  const out: Joints = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Joint>;
  for (const k of keys) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * e;
  return out;
}

/** cubic-bezier(0.45, 0, 0.55, 1), решение по x методом Ньютона. */
export function easeInOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const x1 = 0.45, y1 = 0, x2 = 0.55, y2 = 1;
  const bx = (u: number) => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u ** 2 * (1 - u) + u ** 3;
  const by = (u: number) => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u ** 2 * (1 - u) + u ** 3;
  const dbx = (u: number) => 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u ** 2;
  let u = t;
  for (let i = 0; i < 6; i++) u -= (bx(u) - t) / (dbx(u) || 1e-6);
  return by(Math.min(1, Math.max(0, u)));
}

export type Phase = 'toEnd' | 'pause' | 'toStart' | 'rest';

export interface CycleState {
  /** 0 — кадр start, 1 — кадр end. */
  t: number;
  phase: Phase;
  /** Мышца в концентрической фазе. */
  concentric: boolean;
}

/** Где в цикле down + pause + up + rest мы находимся через `elapsed` секунд. */
export function cycleAt(anim: Pick<ExerciseAnimation, 'tempo' | 'direction' | 'concentric'>, elapsed: number): CycleState {
  if (anim.direction === 'static') return { t: 1, phase: 'pause', concentric: false };
  const { down, pause, up, rest } = anim.tempo;
  const toEnd = anim.direction === 'down' ? down : up;
  const toStart = anim.direction === 'down' ? up : down;
  const total = toEnd + pause + toStart + rest;
  let x = elapsed % total;
  const concToEnd = anim.direction === anim.concentric;
  if (x < toEnd) return { t: x / toEnd, phase: 'toEnd', concentric: concToEnd };
  x -= toEnd;
  if (x < pause) return { t: 1, phase: 'pause', concentric: false };
  x -= pause;
  if (x < toStart) return { t: 1 - x / toStart, phase: 'toStart', concentric: !concToEnd };
  return { t: 0, phase: 'rest', concentric: false };
}

/** Текст чипа темпа: «Вниз 2 с · пауза · вверх 1 с». */
export function tempoText(anim: Pick<ExerciseAnimation, 'tempo' | 'direction' | 'hold_seconds'>): string {
  if (anim.direction === 'static') return anim.hold_seconds ?? 'Статика';
  const fmt = (n: number) => String(n).replace('.', ',');
  const down = `вниз ${fmt(anim.tempo.down)} с`;
  const up = `вверх ${fmt(anim.tempo.up)} с`;
  const [a, b] = anim.direction === 'down' ? [down, up] : [up, down];
  return `${a.charAt(0).toUpperCase()}${a.slice(1)} · пауза · ${b}`;
}

/** Угол сегмента к вертикали/горизонтали, 0…90. */
export function angleTo(alpha: number, reference: 'vertical' | 'horizontal'): number {
  const a = ((alpha % 180) + 180) % 180; // направление без знака
  const fromVertical = Math.min(a, 180 - a);
  return reference === 'vertical' ? fromVertical : 90 - fromVertical;
}
