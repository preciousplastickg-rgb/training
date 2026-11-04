// Анимированный манекен — SPEC 6.7.2. Свой SVG, requestAnimationFrame, без библиотек.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ANIMATION_BY_ID, type AngleGuide, type ExerciseAnimation, type Prop } from '../../data/animations';
import type { Muscle } from '../../db/types';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  angleTo, cycleAt, dir, lerpJoints, poseFor, SEG, type CycleState, type FrontPose, type Joints, type Pose, type Pt, type SidePose,
} from '../../domain/pose';

const W = 200;
const H = 200;
const GROUND = 190;
const BAR_Y = 22;
const BENCH_KNEE = 46;

const OUTLINE = { stroke: 'var(--body-line)', strokeWidth: 0.7, strokeLinejoin: 'round' as const };

const kf = (a: ExerciseAnimation, name: string): Joints => a.keyframes.find((k) => k.name === name)?.joints ?? a.keyframes[0]!.joints;

// ---------- Геометрия ----------

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (p: Pt) => Math.hypot(p.x, p.y);
const mov = (p: Pt, d: Pt, l: number): Pt => ({ x: p.x + d.x * l, y: p.y + d.y * l });
const f1 = (n: number) => Math.round(n * 10) / 10;

/** Капсула с сужением от w1 к w2 и скруглёнными концами. */
function capsule(p1: Pt, p2: Pt, w1: number, w2: number): string {
  const d = sub(p2, p1);
  const l = len(d) || 1;
  const u = { x: d.x / l, y: d.y / l };
  const n = { x: -u.y, y: u.x };
  const r1 = w1 / 2;
  const r2 = w2 / 2;
  const a = mov(p1, n, r1);
  const b = mov(p2, n, r2);
  const c = mov(p2, n, -r2);
  const e = mov(p1, n, -r1);
  return `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}A${f1(r2)} ${f1(r2)} 0 0 1 ${f1(c.x)} ${f1(c.y)}L${f1(e.x)} ${f1(e.y)}A${f1(r1)} ${f1(r1)} 0 0 1 ${f1(a.x)} ${f1(a.y)}Z`;
}

/** Мышца-накладка вдоль сегмента: смещение к передней (+1) или задней (−1) стороне. */
function muscleStrip(p1: Pt, p2: Pt, w: number, side: 1 | -1, from = 0.15, to = 0.85, frontNormal?: Pt): string {
  const d = sub(p2, p1);
  const l = len(d) || 1;
  const u = { x: d.x / l, y: d.y / l };
  const n = frontNormal ?? { x: -u.y, y: u.x };
  const off = side * w * 0.22;
  const a = mov(mov(p1, u, l * from), n, off);
  const b = mov(mov(p1, u, l * to), n, off);
  return capsule(a, b, w * 0.55, w * 0.5);
}

/** Нормаль «вперёд» для сегмента с абсолютным углом α (для ног и корпуса — α + 90). */
const frontOf = (alpha: number) => dir(alpha + 90);

// ---------- Размещение ----------

function translate(p: Pose, dx: number, dy: number): Pose {
  const out: Record<string, unknown> = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (v && typeof v === 'object' && 'x' in v && 'y' in v) out[k] = { x: (v as Pt).x + dx, y: (v as Pt).y + dy };
  }
  return out as unknown as Pose;
}

function points(p: Pose): Pt[] {
  return Object.values(p).filter((v): v is Pt => !!v && typeof v === 'object' && 'x' in v && 'y' in v);
}

interface Fit {
  dx: number;
  dy: number;
  /** Масштаб вокруг перекладины — для виса, чтобы ноги не уходили за кадр. */
  scale: number;
}

/** Смещение фигуры: к полу (или к перекладине), по центру кадра. Одно на всё упражнение. */
function fitOffset(anim: ExerciseAnimation): Fit {
  const ps = [poseFor(anim, kf(anim, 'start')), poseFor(anim, kf(anim, 'end'))];
  const all = ps.flatMap(points);
  const minX = Math.min(...all.map((q) => q.x));
  const maxX = Math.max(...all.map((q) => q.x));
  const dx = W / 2 - (minX + maxX) / 2;
  if (anim.rig === 'hanging') {
    const p0 = ps[0] as SidePose;
    const dy = BAR_Y + 3 - p0.wristR.y;
    const lowest = Math.max(...points(p0).map((q) => q.y)) + dy;
    return { dx, dy, scale: Math.min(1, (GROUND - 6 - BAR_Y) / (lowest - BAR_Y)) };
  }
  const maxY = Math.max(...points(ps[0]!).map((q) => q.y));
  const footPad = anim.view === 'front' ? 6 : 4;
  return { dx, dy: GROUND - maxY - footPad, scale: 1 };
}

/** Колено по двум длинам и положениям таза и стопы; колено — вниз-вперёд. */
function ik2(hip: Pt, target: Pt, l1: number, l2: number): Pt {
  const d = sub(target, hip);
  const dist = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, len(d)));
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const u = { x: d.x / (len(d) || 1), y: d.y / (len(d) || 1) };
  const m = mov(hip, u, a);
  const n = { x: -u.y, y: u.x };
  const k1 = mov(m, n, h);
  const k2 = mov(m, n, -h);
  return k1.y > k2.y ? k1 : k2;
}

const alphaOf = (from: Pt, to: Pt) => (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;

/** Висящие и стоящие: в каждом кадре — к своей опоре (кисти на перекладине, стопа на полу). */
function placed(anim: ExerciseAnimation, joints: Joints, base: Fit): Pose {
  const raw = poseFor(anim, joints);
  if (anim.rig === 'hanging' && raw.view === 'side') {
    const p0 = poseFor(anim, kf(anim, 'start')) as SidePose;
    return translate(raw, base.dx + (p0.wristR.x - raw.wristR.x), base.dy + (p0.wristR.y - raw.wristR.y));
  }
  if (raw.view === 'side' && (anim.rig === 'standing' || anim.rig === 'kneeling')) {
    // Опорная стопа не скользит: держим пятку (или колено на полу) там же, где в кадре start.
    const p0 = poseFor(anim, kf(anim, 'start')) as SidePose;
    const kneeling = anim.rig === 'kneeling' && anim.base === 0;
    const ref0 = kneeling ? p0.knee : p0.heel;
    const ref = kneeling ? raw.knee : raw.heel;
    const p = translate(raw, base.dx + ref0.x - ref.x, base.dy + ref0.y - ref.y) as SidePose;
    // Задняя стопа на скамье неподвижна (болгарские выпады): колено — обратной кинематикой.
    if (anim.props?.some((x) => x.kind === 'bench' && x.under === 'ankleB')) {
      // Скамья на высоте колена, в шаге позади передней стопы.
      const target = { x: p0.heel.x + base.dx - 74, y: GROUND - BENCH_KNEE - 5 };
      const knee = ik2(p.hip, target, SEG.thigh, SEG.shin);
      const aThighB = alphaOf(knee, p.hip);
      const aShinB = alphaOf(target, knee);
      p.kneeB = knee;
      p.ankleB = target;
      p.toeB = mov(target, dir(aShinB + 90), SEG.foot - SEG.heel);
      p.heelB = mov(target, dir(aShinB + 90), -SEG.heel);
      p.a.thighB = aThighB;
      p.a.shinB = aShinB;
    }
    return p;
  }
  return translate(raw, base.dx, base.dy);
}

// ---------- Подсветка ----------

type MuscleFill = (m: Muscle) => { color: string; opacity: number } | null;

function makeFill(anim: ExerciseAnimation, state: CycleState): MuscleFill {
  const primaryOpacity = state.concentric ? 1 : state.phase === 'toEnd' || state.phase === 'toStart' ? 0.8 : 0.5;
  return (m) => {
    if (anim.highlight.primary.includes(m)) return { color: 'var(--m-primary)', opacity: primaryOpacity };
    if (anim.highlight.secondary.includes(m)) return { color: 'var(--m-secondary)', opacity: 0.85 };
    return null;
  };
}

// ---------- Рендер ----------

function SideFigure({ p, fill, gid }: { p: SidePose; fill: MuscleFill; gid: string }) {
  const body = `url(#${gid})`;
  const M = ({ m, d }: { m: Muscle; d: string }) => {
    const f = fill(m);
    return f ? <path d={d} fill={f.color} opacity={f.opacity} /> : null;
  };
  const thighW = 19;
  const shinW = 13;
  const ua = 11;
  const fa = 9;
  const torsoTop = mov(p.shoulder, dir(p.a.torso), -4);
  const torsoFront = frontOf(p.a.torso);

  const leg = (hip: Pt, knee: Pt, ankle: Pt, heel: Pt, toe: Pt, aThigh: number, aShin: number, far: boolean) => (
    <g opacity={far ? 0.72 : 1}>
      <path d={capsule(heel, toe, 8, 7)} fill={body} {...OUTLINE} />
      <path d={capsule(ankle, knee, 9, shinW)} fill={body} {...OUTLINE} />
      <M m="calves" d={muscleStrip(ankle, knee, shinW, -1, 0.35, 0.85, frontOf(aShin))} />
      <path d={capsule(knee, hip, 14, thighW)} fill={body} {...OUTLINE} />
      <M m="quads" d={muscleStrip(knee, hip, thighW, 1, 0.12, 0.8, frontOf(aThigh))} />
      <M m="hamstrings" d={muscleStrip(knee, hip, thighW, -1, 0.12, 0.8, frontOf(aThigh))} />
      <circle cx={knee.x} cy={knee.y} r={6.2} fill="var(--body-a)" {...OUTLINE} />
      <circle cx={ankle.x} cy={ankle.y} r={4.2} fill="var(--body-a)" {...OUTLINE} />
    </g>
  );

  const arm = (elbow: Pt, wrist: Pt, aUa: number, far: boolean) => {
    // Для руки «вперёд» — α − 90 (руки ориентированы вниз).
    const front = dir(aUa - 90);
    return (
      <g opacity={far ? 0.72 : 1}>
        <path d={capsule(p.shoulder, elbow, ua + 1, ua - 1)} fill={body} {...OUTLINE} />
        <M m="biceps" d={muscleStrip(p.shoulder, elbow, ua, 1, 0.25, 0.85, front)} />
        <M m="triceps" d={muscleStrip(p.shoulder, elbow, ua, -1, 0.25, 0.85, front)} />
        <path d={capsule(elbow, wrist, fa, fa - 2)} fill={body} {...OUTLINE} />
        <circle cx={elbow.x} cy={elbow.y} r={4.6} fill="var(--body-a)" {...OUTLINE} />
        <circle cx={wrist.x} cy={wrist.y} r={4} fill={body} {...OUTLINE} />
        <M m="front_delt" d={capsule(mov(p.shoulder, front, 2.5), mov(mov(p.shoulder, dir(aUa), 9), front, 2.5), 7, 4)} />
        <M m="rear_delt" d={capsule(mov(p.shoulder, front, -2.5), mov(mov(p.shoulder, dir(aUa), 9), front, -2.5), 7, 4)} />
        <M m="side_delt" d={capsule(p.shoulder, mov(p.shoulder, dir(aUa), 8), 9, 6)} />
      </g>
    );
  };

  const hasB = !!(p.kneeB && p.ankleB && p.heelB && p.toeB);
  return (
    <g>
      {/* дальние: левая рука и вторая нога */}
      {arm(p.elbowL, p.wristL, p.a.upperArmL, true)}
      {hasB && leg(p.hip, p.kneeB!, p.ankleB!, p.heelB!, p.toeB!, p.a.thighB!, p.a.shinB!, true)}
      {leg(p.hip, p.knee, p.ankle, p.heel, p.toe, p.a.thigh, p.a.shin, false)}
      {/* таз в шортах */}
      <circle cx={p.hip.x} cy={p.hip.y} r={13} fill="var(--m-outline)" {...OUTLINE} />
      <M m="glutes" d={capsule(mov(p.hip, torsoFront, -6), mov(mov(p.hip, torsoFront, -6), dir(p.a.pelvis), -5), 12, 9)} />
      {/* корпус */}
      <path d={capsule(p.hip, torsoTop, 24, 30)} fill={body} {...OUTLINE} />
      <M m="abs" d={muscleStrip(p.hip, torsoTop, 26, 1, 0.12, 0.55, torsoFront)} />
      <M m="chest" d={muscleStrip(p.hip, torsoTop, 30, 1, 0.6, 0.92, torsoFront)} />
      <M m="lower_back" d={muscleStrip(p.hip, torsoTop, 26, -1, 0.1, 0.45, torsoFront)} />
      <M m="lats" d={muscleStrip(p.hip, torsoTop, 28, -1, 0.42, 0.78, torsoFront)} />
      <M m="upper_back" d={muscleStrip(p.hip, torsoTop, 30, -1, 0.72, 0.98, torsoFront)} />
      {/* шея и голова */}
      <path d={capsule(mov(p.shoulder, dir(p.a.torso), -4), p.neck, 10, 9)} fill={body} {...OUTLINE} />
      <circle cx={p.head.x} cy={p.head.y} r={SEG.head + 1} fill={body} {...OUTLINE} />
      {arm(p.elbowR, p.wristR, p.a.upperArmR, false)}
    </g>
  );
}

function FrontFigure({ p, fill, gid }: { p: FrontPose; fill: MuscleFill; gid: string }) {
  const body = `url(#${gid})`;
  const M = ({ m, d }: { m: Muscle; d: string }) => {
    const f = fill(m);
    return f ? <path d={d} fill={f.color} opacity={f.opacity} /> : null;
  };
  const torso = `M${p.shoulderL.x + 4} ${p.shoulderL.y - 3}L${p.hipL.x + 4} ${p.hipL.y - 2}Q${p.pelvis.x} ${p.pelvis.y + 10} ${p.hipR.x - 4} ${p.hipR.y - 2}L${p.shoulderR.x - 4} ${p.shoulderR.y - 3}Q${p.pelvis.x} ${p.shoulderL.y - 8} ${p.shoulderL.x + 4} ${p.shoulderL.y - 3}Z`;
  const arm = (s: Pt, e: Pt, w: Pt, side: 1 | -1) => (
    <g>
      <path d={capsule(s, e, 12, 10)} fill={body} {...OUTLINE} />
      <M m="biceps" d={capsule(mov(s, sub(e, s), 0.3), mov(s, sub(e, s), 0.85), 6, 5)} />
      <path d={capsule(e, w, 9, 7)} fill={body} {...OUTLINE} />
      <circle cx={w.x} cy={w.y} r={4} fill={body} {...OUTLINE} />
      <M m="side_delt" d={capsule({ x: s.x + side * 1, y: s.y - 1 }, mov(s, sub(e, s), 0.32), 15, 11)} />
      <M m="front_delt" d={capsule({ x: s.x - side * 2, y: s.y + 1 }, mov(s, sub(e, s), 0.22), 11, 8)} />
      <circle cx={e.x} cy={e.y} r={4.8} fill="var(--body-a)" {...OUTLINE} />
    </g>
  );
  const legs = (h: Pt, k: Pt, a: Pt) => (
    <g>
      <path d={capsule(h, k, 17, 13)} fill={body} {...OUTLINE} />
      <M m="quads" d={capsule(mov(h, sub(k, h), 0.12), mov(h, sub(k, h), 0.85), 10, 8)} />
      <path d={capsule(k, a, 12, 9)} fill={body} {...OUTLINE} />
      <M m="calves" d={capsule(mov(k, sub(a, k), 0.2), mov(k, sub(a, k), 0.7), 7, 5)} />
      <path d={capsule({ x: a.x, y: a.y + 2 }, { x: a.x + (a.x > 100 ? 5 : -5), y: a.y + 4 }, 7, 6)} fill={body} />
    </g>
  );
  return (
    <g>
      {legs(p.hipL, p.kneeL, p.ankleL)}
      {legs(p.hipR, p.kneeR, p.ankleR)}
      <path d={`M${p.hipL.x + 7} ${p.hipL.y - 6}L${p.hipR.x - 7} ${p.hipR.y - 6}L${p.hipR.x - 8} ${p.hipR.y + 9}L${p.hipL.x + 8} ${p.hipL.y + 9}Z`} fill="var(--m-outline)" {...OUTLINE} />
      <path d={torso} fill={body} {...OUTLINE} />
      <M m="upper_back" d={`M${p.neck.x - 4} ${p.neck.y + 4}L${p.shoulderR.x + 2} ${p.shoulderR.y - 2}L${p.neck.x - 3} ${p.neck.y + 10}Z M${p.neck.x + 4} ${p.neck.y + 4}L${p.shoulderL.x - 2} ${p.shoulderL.y - 2}L${p.neck.x + 3} ${p.neck.y + 10}Z`} />
      <M m="chest" d={capsule({ x: p.pelvis.x - 9, y: p.shoulderL.y + 7 }, { x: p.pelvis.x + 9, y: p.shoulderL.y + 7 }, 12, 12)} />
      <M m="abs" d={capsule({ x: p.pelvis.x, y: p.shoulderL.y + 18 }, { x: p.pelvis.x, y: p.pelvis.y - 6 }, 11, 10)} />
      <M m="lats" d={`M${p.shoulderL.x} ${p.shoulderL.y + 8}L${p.hipL.x + 5} ${p.hipL.y - 14}L${p.shoulderL.x - 6} ${p.shoulderL.y + 12}Z M${p.shoulderR.x} ${p.shoulderR.y + 8}L${p.hipR.x - 5} ${p.hipR.y - 14}L${p.shoulderR.x + 6} ${p.shoulderR.y + 12}Z`} />
      <path d={capsule({ x: p.neck.x, y: p.neck.y + 8 }, p.neck, 10, 9)} fill={body} {...OUTLINE} />
      <circle cx={p.head.x} cy={p.head.y} r={SEG.head + 1} fill={body} {...OUTLINE} />
      {arm(p.shoulderL, p.elbowL, p.wristL, 1)}
      {arm(p.shoulderR, p.elbowR, p.wristR, -1)}
    </g>
  );
}

function Equipment({ anim, p, start }: { anim: ExerciseAnimation; p: Pose; start: Pose }) {
  const ink = 'var(--ink)';
  if (anim.equipment === 'none') return null;
  if (p.view === 'front') {
    if (anim.equipment !== 'dumbbell') return null;
    return (
      <g fill={ink} opacity={0.85}>
        {[p.wristL, p.wristR].map((w, i) => (
          <g key={i}>
            <rect x={w.x - 9} y={w.y - 2} width={18} height={4} rx={1.5} />
            <rect x={w.x - 11} y={w.y - 5} width={5} height={10} rx={1.5} />
            <rect x={w.x + 6} y={w.y - 5} width={5} height={10} rx={1.5} />
          </g>
        ))}
      </g>
    );
  }
  const w = p.wristR;
  if (anim.equipment === 'dumbbell') {
    if (anim.hold === 'goblet') {
      const u = dir(p.a.torso);
      const c = mov(mov(w, frontOf(p.a.torso), 3), u, -4);
      return <path d={capsule(mov(c, u, -9), mov(c, u, 9), 11, 11)} fill={ink} opacity={0.85} />;
    }
    return (
      <g fill={ink} opacity={0.85}>
        <circle cx={w.x} cy={w.y} r={6.5} />
        <circle cx={p.wristL.x} cy={p.wristL.y} r={6.5} opacity={0.55} />
      </g>
    );
  }
  if (anim.equipment === 'barbell') {
    const at = anim.hold === 'back' ? mov(mov(p.shoulder, frontOf(p.a.torso), -5), dir(p.a.torso), 1) : w;
    return (
      <g>
        <circle cx={at.x} cy={at.y} r={16} fill={ink} opacity={0.82} />
        <circle cx={at.x} cy={at.y} r={3} fill="var(--surface)" />
      </g>
    );
  }
  // cable: рукоять и трос к блоку
  const pulley = anim.props?.find((x): x is Extract<Prop, { kind: 'pulley' }> => x.kind === 'pulley');
  const s = start as SidePose;
  const top = { x: s.wristR.x + (pulley?.dx ?? 0), y: pulley?.y ?? 8 };
  return (
    <g>
      <line x1={top.x} y1={top.y} x2={w.x} y2={w.y} stroke="var(--muted)" strokeWidth={1.2} />
      <circle cx={top.x} cy={top.y} r={5} fill="none" stroke="var(--muted)" strokeWidth={2} />
      <rect x={w.x - 7} y={w.y - 2} width={14} height={4} rx={2} fill={ink} opacity={0.85} />
    </g>
  );
}

function Props({ anim, p, start }: { anim: ExerciseAnimation; p: Pose; start: Pose }) {
  const c = 'var(--m-outline)';
  const out: React.ReactNode[] = [];
  if (anim.rig !== 'hanging') {
    out.push(<line key="floor" x1={8} y1={GROUND + 1} x2={W - 8} y2={GROUND + 1} stroke="var(--line)" strokeWidth={2} strokeLinecap="round" />);
  }
  for (const [i, prop] of (anim.props ?? []).entries()) {
    if (prop.kind === 'bar') {
      out.push(<line key={i} x1={30} y1={BAR_Y} x2={170} y2={BAR_Y} stroke="var(--muted)" strokeWidth={3} strokeLinecap="round" />);
    }
    if (p.view !== 'side' || start.view !== 'side') {
      if (prop.kind === 'bench' && p.view === 'front') {
        const y = p.pelvis.y + 10;
        out.push(<rect key={i} x={p.pelvis.x - 24} y={y} width={48} height={7} rx={3} fill={c} />);
        out.push(<rect key={`${i}l`} x={p.pelvis.x - 3} y={y + 7} width={6} height={GROUND - y - 7} fill={c} />);
      }
      continue;
    }
    if (prop.kind === 'bench') {
      let x1: number, x2: number, top: number;
      if (prop.under === 'torso') {
        x1 = Math.min(p.head.x, p.shoulder.x) - 6;
        x2 = p.hip.x + 14;
        top = Math.max(p.hip.y, p.shoulder.y) + 10;
      } else if (prop.under === 'hips') {
        x1 = p.hip.x - 16;
        x2 = p.hip.x + 22;
        top = p.hip.y + 10;
      } else if (prop.under === 'support') {
        x1 = Math.min(p.kneeB?.x ?? p.knee.x, p.ankleB?.x ?? p.knee.x) - 6;
        x2 = p.wristL.x + 10;
        top = (p.kneeB?.y ?? p.knee.y) + 5;
      } else {
        const s = start;
        x1 = (s.ankleB?.x ?? s.ankle.x) - 16;
        x2 = (s.ankleB?.x ?? s.ankle.x) + 12;
        top = (s.ankleB?.y ?? s.ankle.y) + 4;
      }
      out.push(<rect key={i} x={x1} y={top} width={x2 - x1} height={7} rx={3} fill={c} />);
      out.push(<rect key={`${i}a`} x={x1 + 4} y={top + 7} width={5} height={GROUND - top - 7} fill={c} />);
      out.push(<rect key={`${i}b`} x={x2 - 9} y={top + 7} width={5} height={GROUND - top - 7} fill={c} />);
    }
    if (prop.kind === 'incline') {
      const back = frontOf(p.a.torso);
      const a = mov(mov(p.hip, back, -12), dir(p.a.torso), -6);
      const b = mov(mov(p.shoulder, back, -12), dir(p.a.torso), 10);
      out.push(<path key={i} d={capsule(a, b, 7, 7)} fill={c} />);
      const seatEnd = mov(a, dir(p.a.thigh + 180), 26);
      out.push(<path key={`${i}s`} d={capsule(a, seatEnd, 7, 7)} fill={c} />);
      out.push(<rect key={`${i}l`} x={a.x - 3} y={a.y} width={6} height={Math.max(0, GROUND - a.y)} fill={c} />);
    }
    if (prop.kind === 'platform') {
      const n = dir(p.a.shin + 90);
      const a = mov(mov(p.ankle, dir(p.a.shin), -4), n, -14);
      const b = mov(mov(p.ankle, dir(p.a.shin), -4), n, 26);
      out.push(<path key={i} d={capsule(a, b, 6, 6)} fill={c} />);
    }
    if (prop.kind === 'kneePad') {
      const k = mov(p.knee, { x: 0, y: -1 }, 12);
      out.push(<rect key={i} x={k.x - 9} y={k.y - 4} width={18} height={8} rx={4} fill={c} />);
    }
  }
  return <>{out}</>;
}

// ---------- Подсказки углов ----------

function segmentOf(p: Pose, g: AngleGuide): { base: Pt; alpha: number } | null {
  if (p.view === 'side') {
    switch (g.segment) {
      case 'torso': return { base: p.hip, alpha: p.a.torso };
      case 'thigh': return { base: p.hip, alpha: p.a.thigh + 180 };
      case 'shin': return { base: p.ankle, alpha: p.a.shin };
      case 'upperArm': return { base: p.shoulder, alpha: p.a.upperArmR };
      case 'forearm': return { base: p.elbowR, alpha: p.a.forearmR };
    }
  }
  if (p.view === 'front') {
    const toAlpha = (from: Pt, to: Pt) => (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
    switch (g.segment) {
      case 'torso': return { base: p.pelvis, alpha: 0 };
      case 'upperArm': return { base: p.shoulderL, alpha: toAlpha(p.shoulderL, p.elbowL) };
      case 'forearm': return { base: p.elbowL, alpha: toAlpha(p.elbowL, p.wristL) };
      default: return null;
    }
  }
  return null;
}

interface GuideGeom {
  g: AngleGuide;
  lines: [Pt, Pt][];
  arc?: string;
  label: Pt;
  anchor: 'start' | 'middle' | 'end';
}

function guideGeom(p: Pose, g: AngleGuide, k: number): GuideGeom | null {
  const seg = segmentOf(p, g);
  if (!seg) return null;
  if (g.reference === 'along') {
    const u = dir(seg.alpha);
    const a = mov(seg.base, u, -14);
    const b = mov(seg.base, u, SEG.torso + 26);
    const side = dir(seg.alpha - 90);
    const lab = mov(b, side, 10 * k);
    return { g, lines: [[a, b]], label: lab, anchor: lab.x > W / 2 ? 'end' : 'start' };
  }
  if (g.reference === 'horizontal' && g.value === 0 && !g.text) {
    const y = p.view === 'front' ? p.shoulderL.y : seg.base.y;
    return { g, lines: [[{ x: 14, y }, { x: W - 14, y }]], label: { x: W - 16, y: y - 6 * k }, anchor: 'end' };
  }
  const segDir = dir(seg.alpha);
  let refAlpha: number;
  if (g.reference === 'vertical') refAlpha = Math.abs((((seg.alpha % 360) + 360) % 360) - 180) < 90 ? 180 : 0;
  else refAlpha = segDir.x >= 0 ? 90 : 270;
  const refDir = dir(refAlpha);
  const R = 16;
  const refEnd = mov(seg.base, refDir, 32);
  const a0 = mov(seg.base, refDir, R);
  const a1 = mov(seg.base, segDir, R);
  const cross = refDir.x * segDir.y - refDir.y * segDir.x;
  const sweep = cross > 0 ? 1 : 0;
  const bis = { x: refDir.x + segDir.x, y: refDir.y + segDir.y };
  const bl = len(bis) || 1;
  const measured = angleTo(seg.alpha, g.reference);
  // Подпись снаружи угла, чуть дальше дуги.
  const lab = mov(seg.base, bl < 0.2 ? dir(refAlpha + 90) : { x: bis.x / bl, y: bis.y / bl }, R + 18 * k);
  return {
    g,
    lines: [[seg.base, refEnd]],
    arc: measured > 2 ? `M${f1(a0.x)} ${f1(a0.y)}A${R} ${R} 0 0 ${sweep} ${f1(a1.x)} ${f1(a1.y)}` : undefined,
    label: lab,
    anchor: 'middle',
  };
}

/** Раздвигаем подписи, чтобы не налезали друг на друга и не выходили за край. */
function layoutLabels(geoms: GuideGeom[], k: number): void {
  const h = 28 * k;
  geoms.forEach((gm, i) => {
    const text = gm.g.text ?? `~${gm.g.value}°`;
    const w = Math.max(gm.g.label.length * 6.2, text.length * 7.4) * k;
    if (gm.anchor === 'middle') gm.label.x = Math.min(W - 4 - w / 2, Math.max(4 + w / 2, gm.label.x));
    for (let j = 0; j < i; j++) {
      const o = geoms[j]!;
      if (Math.abs(o.label.x - gm.label.x) < w && Math.abs(o.label.y - gm.label.y) < h) {
        gm.label.y = o.label.y + (gm.label.y >= o.label.y ? h : -h);
      }
    }
    gm.label.y = Math.min(H - 16 * k, Math.max(12 * k, gm.label.y));
  });
}

function Guide({ gm, k }: { gm: GuideGeom; k: number }) {
  const col = 'var(--guide)';
  const halo = { stroke: 'var(--surface)', strokeWidth: 3 * k, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };
  const { g } = gm;
  const lineOnly = g.reference === 'along' || (g.reference === 'horizontal' && g.value === 0 && !g.text);
  const value = g.text ?? `~${g.value}°`;
  return (
    <g>
      {gm.lines.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={1.5 * k} strokeDasharray={`${4 * k} ${3 * k}`} />
      ))}
      {gm.arc && <path d={gm.arc} fill="none" stroke={col} strokeWidth={2.5 * k} strokeLinecap="round" />}
      <text x={gm.label.x} y={gm.label.y} fontSize={11 * k} fill={col} textAnchor={gm.anchor} {...halo}>
        {g.label}
      </text>
      {!lineOnly && (
        <text x={gm.label.x} y={gm.label.y + 14 * k} fontSize={13 * k} fontWeight={700} fill={col} textAnchor={gm.anchor} {...halo}>
          {value}
        </text>
      )}
      {g.warn && (
        <text x={gm.label.x} y={gm.label.y + (lineOnly ? 14 : 28) * k} fontSize={11 * k} fill="var(--warn)" textAnchor={gm.anchor} {...halo}>
          {g.warn}
        </text>
      )}
    </g>
  );
}

// ---------- Компонент ----------

interface MannequinProps {
  exerciseId: string;
  /** Статичный кадр вместо анимации. */
  frame?: 'start' | 'end';
  playing?: boolean;
  size?: number;
  showGuides?: boolean;
}

export function Mannequin({ exerciseId, frame, playing = true, size = 220, showGuides = true }: MannequinProps) {
  const anim = ANIMATION_BY_ID[exerciseId];
  const gid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  const animate = !frame && playing && !reduced && anim?.direction !== 'static';

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!animate || !visible) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      if (document.visibilityState === 'visible') setElapsed((e) => e + (now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, visible]);

  const offset = useMemo<Fit>(() => (anim ? fitOffset(anim) : { dx: 0, dy: 0, scale: 1 }), [anim]);
  if (!anim) return null;

  const state: CycleState = animate
    ? cycleAt(anim, elapsed)
    : { t: (frame ?? 'end') === 'end' ? 1 : 0, phase: (frame ?? 'end') === 'end' ? 'pause' : 'rest', concentric: false };
  const joints = lerpJoints(kf(anim, 'start'), kf(anim, 'end'), state.t);
  const pose = placed(anim, joints, offset);
  const startPose = placed(anim, kf(anim, 'start'), offset);
  const fill = makeFill(anim, state);
  const atKey = state.phase === 'pause' ? 'end' : state.phase === 'rest' ? 'start' : null;
  const guides = showGuides ? anim.angles.filter((g) => g.keyframe === atKey || anim.direction === 'static') : [];
  // Размер шрифта подсказок — в пикселях экрана (SPEC: подпись 11 px, число 13 px).
  const k = (W / size) * (offset.scale < 1 ? 1 / offset.scale : 1);
  const geoms = guides.map((g) => guideGeom(pose, g, k)).filter((x): x is GuideGeom => !!x);
  layoutLabels(geoms, k);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={size} height={size} role="img" aria-label="Техника упражнения">
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--body-a)" />
          <stop offset="0.5" stopColor="var(--body-b)" />
          <stop offset="1" stopColor="var(--body-a)" />
        </linearGradient>
      </defs>
      <g transform={offset.scale < 1 ? `translate(${W / 2} ${BAR_Y}) scale(${offset.scale}) translate(${-W / 2} ${-BAR_Y})` : undefined}>
      <Props anim={anim} p={pose} start={startPose} />
      {pose.view === 'side' ? <SideFigure p={pose} fill={fill} gid={gid} /> : <FrontFigure p={pose} fill={fill} gid={gid} />}
      <Equipment anim={anim} p={pose} start={startPose} />
      <g key={atKey ?? 'none'} className="animate-fade-in" style={{ animationDuration: '150ms' }}>
        {geoms.map((gm, i) => (
          <Guide key={i} gm={gm} k={k} />
        ))}
      </g>
      </g>
    </svg>
  );
}
